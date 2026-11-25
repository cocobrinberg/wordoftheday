import { cacheLife } from "next/cache";

/**
 * Translate English text with the free MyMemory API (no key needed).
 * Results are cached indefinitely per (text, language), so each word is only
 * translated once per language. Failures throw and are not cached.
 */
export async function translateText(text: string, lang: string): Promise<string> {
  "use cache";
  cacheLife("max");

  if (!text.trim()) return text;
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `en|${lang}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation service returned ${res.status}`);
  const body = (await res.json()) as {
    responseStatus: number | string;
    responseDetails?: string;
    quotaFinished?: boolean;
    responseData?: { translatedText?: string };
  };
  const translated = body.responseData?.translatedText;
  if (
    Number(body.responseStatus) !== 200 ||
    body.quotaFinished ||
    !translated ||
    translated.startsWith("MYMEMORY WARNING")
  ) {
    throw new Error(body.responseDetails || translated || "Translation failed");
  }
  return translated;
}
