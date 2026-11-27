"use client";

import { useEffect, useState } from "react";
import { ENGLISH, type Language } from "@/lib/languages";
import type { Word } from "@/lib/supabase";
import type { WordTranslation } from "@/app/api/translate-words/route";

const keyFor = (lang: string, w: Pick<Word, "word" | "part_of_speech">) =>
  `${lang}|${w.word.toLowerCase()}|${w.part_of_speech}`;

/** Translations already fetched in this tab, shared by every page. */
const cache = new Map<string, WordTranslation>();

/**
 * Translations of quiz words into `lang`, keyed by English word.
 * Returns `null` for English, `undefined` while loading, or an error message.
 */
export function useWordTranslations(
  words: Pick<Word, "word" | "part_of_speech">[],
  lang: Language,
): { get: (w: Pick<Word, "word" | "part_of_speech">) => WordTranslation | undefined; loading: boolean; error: string | null } {
  const [, setVersion] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEnglish = lang.code === ENGLISH.code;
  const missing = isEnglish ? [] : words.filter((w) => !cache.has(keyFor(lang.code, w)));
  const missingKey = missing.map((w) => keyFor(lang.code, w)).join(",");
  const error = errors[missingKey] ?? null;

  useEffect(() => {
    if (!missingKey || errors[missingKey]) return;
    const todo = missingKey.split(",").map((k) => {
      const [, word, pos] = k.split("|");
      return { word, pos };
    });
    const params = new URLSearchParams({ lang: lang.code });
    todo.forEach((t) => params.append("w", `${t.word}:${t.pos}`));
    let cancelled = false;
    fetch(`/api/translate-words?${params}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        (body.words as WordTranslation[]).forEach((t, i) =>
          cache.set(`${lang.code}|${todo[i].word}|${todo[i].pos}`, t),
        );
        if (!cancelled) setVersion((v) => v + 1);
      })
      .catch((e: Error) => {
        if (!cancelled) setErrors((r) => ({ ...r, [missingKey]: e.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [missingKey, lang.code, errors]);

  return {
    get: (w) => (isEnglish ? undefined : cache.get(keyFor(lang.code, w))),
    loading: missing.length > 0 && !error,
    error,
  };
}

/**
 * A quiz choice in the chosen language, laid out like the Today card: the
 * translated word, pinyin for Mandarin, the part of speech, and the English
 * word (shown once `revealEnglish` is true, so it doesn't give the answer away).
 */
export function WordLabel({
  word,
  translation,
  lang,
  revealEnglish,
}: {
  word: Word;
  translation: WordTranslation | undefined;
  lang: Language;
  revealEnglish: boolean;
}) {
  if (lang.code === ENGLISH.code || !translation) {
    return <span className="font-serif text-xl font-medium">{word.word}</span>;
  }
  return (
    <span lang={lang.code} dir={lang.rtl ? "rtl" : "ltr"} className="flex min-w-0 flex-col items-start">
      <span className="font-serif text-xl font-medium break-words">{translation.word}</span>
      {translation.pinyin && (
        <span lang="zh-Latn-pinyin" className="text-sm font-bold tracking-wide text-orange-600">
          {translation.pinyin}
        </span>
      )}
      <span className="mt-1 flex flex-wrap gap-x-2 text-xs font-bold text-stone-500">
        {translation.part_of_speech && <span>{translation.part_of_speech}</span>}
        {revealEnglish && (
          <span lang="en" dir="ltr">
            English: {word.word}
          </span>
        )}
      </span>
    </span>
  );
}

/** The correct answer as shown in the "Not quite" message. */
export function AnswerName({
  word,
  translation,
  lang,
}: {
  word: Word;
  translation: WordTranslation | undefined;
  lang: Language;
}) {
  if (lang.code === ENGLISH.code || !translation) {
    return <strong className="font-serif font-semibold">{word.word}</strong>;
  }
  return (
    <>
      <strong lang={lang.code} className="font-serif font-semibold">
        {translation.word}
      </strong>
      {translation.pinyin && (
        <span lang="zh-Latn-pinyin"> ({translation.pinyin})</span>
      )}{" "}
      <span lang="en">&middot; English: {word.word}</span>
    </>
  );
}
