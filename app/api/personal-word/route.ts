import { pinyin } from "pinyin-pro";
import { ENGLISH, findLanguage } from "@/lib/languages";
import { personalWord, type PersonalWord } from "@/lib/personalWord";
import { translateText } from "@/lib/translate";

export type PersonalWordResponse = PersonalWord & { english: string; pinyin?: string };

/** GET /api/personal-word?hobby=a&hobby=b…&day=YYYY-MM-DD[&lang=es] */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hobbies = [...new Set(params.getAll("hobby").map((h) => h.trim().toLowerCase()))]
    .filter(Boolean)
    .sort();
  const day = params.get("day") ?? "";
  const lang = findLanguage(params.get("lang") ?? ENGLISH.code);
  if (!hobbies.length || hobbies.length > 5 || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !lang) {
    return Response.json(
      { error: "Expected up to five hobbies, a day and a supported language" },
      { status: 400 },
    );
  }

  try {
    const word = await personalWord(hobbies, day);
    const result: PersonalWordResponse = { ...word, english: word.word };
    if (lang.code !== ENGLISH.code) {
      // Like the shared word, the definition stays in English.
      const [w, pos, example] = await Promise.all(
        [word.word, word.part_of_speech, word.example].map((t) => translateText(t, lang.code)),
      );
      Object.assign(result, { word: w, part_of_speech: pos, example });
      if (lang.code.startsWith("zh")) result.pinyin = pinyin(w);
    }
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
