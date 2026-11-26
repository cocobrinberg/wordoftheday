import { supabase } from "@/lib/supabase";

type Entry = {
  meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[];
};

/**
 * POST /api/suggest { token, word }
 * Looks the word up in the free dictionaryapi.dev, then schedules it as a
 * word of the day. Responds with { day: "YYYY-MM-DD" }.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; word?: string } | null;
  const word = body?.word?.trim().toLowerCase() ?? "";
  if (!body?.token || !/^[a-z]+(-[a-z]+)*$/.test(word) || word.length > 30) {
    return Response.json({ error: "Enter a single word, letters only." }, { status: 400 });
  }

  const dict = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (dict.status === 404) {
    return Response.json(
      { error: `We couldn’t find “${word}” in the dictionary. Check the spelling?` },
      { status: 400 },
    );
  }
  if (!dict.ok) {
    return Response.json({ error: "The dictionary isn’t answering right now. Try again soon." }, { status: 502 });
  }
  const meaning = ((await dict.json()) as Entry[]).flatMap((e) => e.meanings).find((m) => m.definitions.length);
  if (!meaning) {
    return Response.json({ error: `We couldn’t find a definition for “${word}”.` }, { status: 400 });
  }
  const definition = meaning.definitions[0].definition;
  const example = meaning.definitions.find((d) => d.example)?.example ?? "";

  const { data, error } = await supabase.rpc("suggest_word", {
    p_token: body.token,
    p_word: word,
    p_part_of_speech: meaning.partOfSpeech,
    p_definition: definition,
    p_example: example,
  });
  if (error) {
    const missing = error.code === "PGRST202" || error.message.includes("Could not find the function");
    return Response.json(
      { error: missing ? "Suggestions aren’t set up yet. Run supabase/suggestions.sql first." : error.message },
      { status: missing ? 503 : 400 },
    );
  }
  return Response.json({ day: data as string, word, part_of_speech: meaning.partOfSpeech, definition });
}
