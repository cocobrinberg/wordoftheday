import { cacheLife } from "next/cache";

export type PersonalWord = {
  word: string;
  part_of_speech: string;
  definition: string;
  example: string;
  /** The hobby this word was picked for. */
  hobby: string;
};

const POS: Record<string, string> = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };

type DatamuseWord = { word: string; score: number; tags?: string[]; defs?: string[] };

/** Small, stable string hash so the same day + hobby always gives the same word. */
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const STOP = new Set("the and for with that this from into such used any one who which are its".split(" "));

/** Lowercase words of 3+ letters, minus filler, trimmed to a rough stem. */
function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{3,}/g) ?? [])
    .filter((w) => !STOP.has(w))
    .map((w) => w.slice(0, 6));
}

function daysSinceEpoch(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Which of the user's hobbies today's word is about: they take turns, one per day. */
export function hobbyForDay(hobbies: string[], day: string): string {
  const sorted = [...hobbies].sort();
  return sorted[daysSinceEpoch(day) % sorted.length];
}

/**
 * A word of the day related to one of the user's hobbies. Candidates come from
 * the free Datamuse API (no key), and the example sentence from the free
 * dictionaryapi.dev when it has one. Cached per (hobbies, day).
 */
export async function personalWord(hobbies: string[], day: string): Promise<PersonalWord> {
  "use cache";
  cacheLife("days");

  const hobby = hobbyForDay(hobbies, day);
  const url = new URL("https://api.datamuse.com/words");
  url.searchParams.set("ml", hobby);
  url.searchParams.set("topics", hobby);
  url.searchParams.set("md", "dpf");
  url.searchParams.set("max", "100");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Word service returned ${res.status}`);
  const words = (await res.json()) as DatamuseWord[];

  // Skip the hobby's own words ("climbing" for "rock climbing"), very common
  // words, and anything without a definition.
  const stems = hobby.split(/\s+/).map((w) => w.slice(0, 5));
  const freq = (w: DatamuseWord) =>
    Number(w.tags?.find((t) => t.startsWith("f:"))?.slice(2) ?? 0);
  let candidates = words.filter(
    (w) =>
      /^[a-z]{4,}$/.test(w.word) &&
      w.defs?.length &&
      !stems.some((s) => w.word.startsWith(s)) &&
      freq(w) < 4,
  );
  // Prefer less common words, but fall back to anything usable.
  const interesting = candidates.filter((w) => freq(w) > 0.03);
  if (interesting.length >= 3) candidates = interesting;
  candidates = candidates.slice(0, 30);
  if (!candidates.length) {
    throw new Error(`Couldn't find a word about “${hobby}”. Try describing that hobby differently.`);
  }

  const pick = candidates[hash(`${day}|${hobby}`) % candidates.length];

  // Words have many meanings; use the one that sounds most like the hobby.
  const hobbyWords = new Set(contentWords(`${hobby} ${words.slice(0, 15).map((w) => w.word).join(" ")}`));
  const relevance = (text: string) => contentWords(text).filter((w) => hobbyWords.has(w)).length;
  const defs = pick.defs!.map((d) => {
    const [code, text] = d.split("\t");
    return { pos: POS[code] ?? code, text: text.trim() };
  });
  const best = defs.reduce((a, b) => (relevance(b.text) > relevance(a.text) ? b : a));
  const result: PersonalWord = {
    word: pick.word,
    part_of_speech: best.pos,
    definition: best.text,
    example: "",
    hobby,
  };

  // Add an example sentence when the dictionary has one for this same meaning.
  try {
    const dict = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(pick.word)}`,
    );
    if (dict.ok) {
      type Entry = {
        meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[];
      };
      const entries = (await dict.json()) as Entry[];
      const meanings = entries.flatMap((e) => e.meanings);
      const ours = new Set(contentWords(best.text));
      const match = meanings
        .filter((m) => m.partOfSpeech === best.pos)
        .flatMap((m) => m.definitions)
        .filter((d) => d.example)
        .map((d) => ({ d, overlap: contentWords(d.definition).filter((w) => ours.has(w)).length }))
        .sort((a, b) => b.overlap - a.overlap)[0];
      if (match && match.overlap >= 2) result.example = match.d.example!;
    }
  } catch {
    // The Datamuse definition is good enough on its own.
  }
  return result;
}
