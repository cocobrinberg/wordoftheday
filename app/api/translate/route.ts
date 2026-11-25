import { supabase, type Word } from "@/lib/supabase";
import { ENGLISH, findLanguage } from "@/lib/languages";
import { translateText } from "@/lib/translate";

export type TranslatedWord = Pick<Word, "word" | "part_of_speech" | "definition" | "example">;

/** GET /api/translate?id=<word id>&lang=<language code> */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = Number(params.get("id"));
  const lang = findLanguage(params.get("lang"));
  if (!Number.isInteger(id) || !lang || lang.code === ENGLISH.code) {
    return Response.json({ error: "Expected a word id and a supported language" }, { status: 400 });
  }

  const { data: word, error } = await supabase
    .from("words")
    .select("word, part_of_speech, definition, example")
    .eq("id", id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!word) return Response.json({ error: "Word not found" }, { status: 404 });

  try {
    const [w, pos, definition, example] = await Promise.all(
      [word.word, word.part_of_speech, word.definition, word.example ?? ""].map((t) =>
        translateText(t, lang.code),
      ),
    );
    const result: TranslatedWord = { word: w, part_of_speech: pos, definition, example };
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
