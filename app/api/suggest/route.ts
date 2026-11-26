import { supabase } from "@/lib/supabase";
import { checkWord } from "@/lib/checkWord";

/**
 * POST /api/suggest { token, word }
 * Makes sure the word is real (Wiktionary, falling back to dictionaryapi.dev),
 * then schedules it as a word of the day. Responds with { day: "YYYY-MM-DD", … }.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; word?: string } | null;
  const word = body?.word?.trim().toLowerCase() ?? "";
  if (!body?.token || !/^[a-z]+(-[a-z]+)*$/.test(word) || word.length > 30) {
    return Response.json({ error: "Enter a single word, letters only." }, { status: 400 });
  }

  const check = await checkWord(word);
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  const { data, error } = await supabase.rpc("suggest_word", {
    p_token: body.token,
    p_word: word,
    p_part_of_speech: check.part_of_speech,
    p_definition: check.definition,
    p_example: check.example,
  });
  if (error) {
    const missing = error.code === "PGRST202" || error.message.includes("Could not find the function");
    return Response.json(
      { error: missing ? "Suggestions aren’t set up yet. Run supabase/suggestions.sql first." : error.message },
      { status: missing ? 503 : 400 },
    );
  }
  return Response.json({
    day: data as string,
    word,
    part_of_speech: check.part_of_speech,
    definition: check.definition,
  });
}
