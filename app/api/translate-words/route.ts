import { pinyin } from "pinyin-pro";
import { ENGLISH, findLanguage } from "@/lib/languages";
import { translateText } from "@/lib/translate";

export type WordTranslation = {
  word: string;
  part_of_speech: string;
  /** Romanization of the word, for Mandarin only. */
  pinyin?: string;
};

/** Most words asked for at once (a quiz question has four choices). */
const MAX_WORDS = 8;
const WORD = /^[a-z][a-z' -]{0,39}$/i;
const POS = /^[a-z ]{0,20}$/i;

/**
 * GET /api/translate-words?lang=zh-CN&w=abhor:verb&w=zest:noun
 * Translates quiz words (and their parts of speech) out of English.
 * Only short dictionary words are accepted, so this can't be used as a
 * general translation proxy.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lang = findLanguage(params.get("lang"));
  const items = params.getAll("w").map((s) => {
    const i = s.lastIndexOf(":");
    return i < 0 ? { word: s, pos: "" } : { word: s.slice(0, i), pos: s.slice(i + 1) };
  });
  if (
    !lang ||
    lang.code === ENGLISH.code ||
    !items.length ||
    items.length > MAX_WORDS ||
    !items.every((x) => WORD.test(x.word) && POS.test(x.pos))
  ) {
    return Response.json(
      { error: `Expected a supported language and 1–${MAX_WORDS} words` },
      { status: 400 },
    );
  }

  try {
    const words = await Promise.all(
      items.map(async ({ word, pos }) => {
        const [w, p] = await Promise.all([
          translateText(word, lang.code),
          pos ? translateText(pos, lang.code) : "",
        ]);
        const result: WordTranslation = { word: w, part_of_speech: p };
        if (lang.code.startsWith("zh")) result.pinyin = pinyin(w);
        return result;
      }),
    );
    return Response.json({ words });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
