/** What we know about a suggested word, or why it can't be used. */
export type WordCheck =
  | { ok: true; part_of_speech: string; definition: string; example: string }
  | { ok: false; error: string; status: number };

const notReal = (word: string): WordCheck => ({
  ok: false,
  status: 400,
  error: `“${word}” doesn’t look like a real English word. Check the spelling?`,
});

/**
 * Words that can't be a word of the day for students. Wiktionary's API drops
 * its "vulgar"/"offensive" labels, so these are listed here. Add to it freely.
 */
const BLOCKED = new Set(
  (
    "fuck fucker fucking motherfucker shit shitty bullshit bitch bastard asshole arse arsehole " +
    "cunt dick dickhead cock prick pussy twat wanker bollocks slut whore piss pissed crap damn " +
    "nigger nigga faggot fag retard retarded spic chink kike tranny dyke"
  ).split(" "),
);

/** Kinds of entries that aren't ordinary words. */
const SKIP_POS = new Set([
  "proper noun", "abbreviation", "initialism", "acronym", "symbol", "letter",
  "prefix", "suffix", "affix", "infix", "interfix", "punctuation mark", "romanization",
]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** HTML from Wiktionary to plain text. */
function plain(html: string): string {
  return html
    .replace(/<(ol|ul|dl)\b[\s\S]*<\/\1>/gi, "") // nested sub-meanings
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
      e[0] === "#"
        ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
        : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/\(Can we [^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type WiktionaryDef = { definition: string; parsedExamples?: { example: string }[] };
type WiktionaryEntry = { partOfSpeech: string; language: string; definitions: WiktionaryDef[] };

/**
 * Looks the word up in Wiktionary (free, no key). It counts as real when it
 * has an ordinary English entry that isn't only a misspelling, a name or an
 * abbreviation. Returns null when Wiktionary can't be reached.
 */
async function checkWithWiktionary(word: string): Promise<WordCheck | null> {
  let res: Response;
  try {
    res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`, {
      headers: { "User-Agent": "WordOfTheDayApp/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return null;
  }
  if (res.status === 404) return notReal(word);
  if (!res.ok) return null;

  const entries = (((await res.json()) as { en?: WiktionaryEntry[] }).en ?? []).filter(
    (e) => e.language === "English" && !SKIP_POS.has(e.partOfSpeech.toLowerCase()),
  );
  const senses = entries.flatMap((e) =>
    e.definitions
      .map((d) => ({
        pos: e.partOfSpeech.toLowerCase(),
        text: plain(d.definition),
        example: plain(d.parsedExamples?.[0]?.example ?? ""),
      }))
      .filter((s) => s.text && !/misspelling of/i.test(s.text)),
  );
  if (!senses.length) return notReal(word);

  // Wiktionary lists the main meaning first.
  const best = senses[0];
  const example = best.example || senses.find((s) => s.pos === best.pos && s.example)?.example || "";
  return { ok: true, part_of_speech: best.pos, definition: best.text, example };
}

type DictEntry = {
  meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[];
};

/** The free dictionaryapi.dev, used when Wiktionary can't be reached. */
async function checkWithDictionaryApi(word: string): Promise<WordCheck> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (res.status === 404) return notReal(word);
  if (!res.ok) {
    return { ok: false, status: 502, error: "The dictionary isn’t answering right now. Try again soon." };
  }
  const meaning = ((await res.json()) as DictEntry[]).flatMap((e) => e.meanings).find((m) => m.definitions.length);
  if (!meaning) return notReal(word);
  return {
    ok: true,
    part_of_speech: meaning.partOfSpeech,
    definition: meaning.definitions[0].definition,
    example: meaning.definitions.find((d) => d.example)?.example ?? "",
  };
}

/** Makes sure a suggested word is a real, school-friendly English word and returns its definition. */
export async function checkWord(word: string): Promise<WordCheck> {
  if (BLOCKED.has(word)) {
    return { ok: false, status: 400, error: `“${word}” can’t be a word of the day. Try another one.` };
  }
  return (await checkWithWiktionary(word)) ?? checkWithDictionaryApi(word);
}
