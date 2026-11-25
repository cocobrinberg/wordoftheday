"use client";

import { useEffect, useState } from "react";
import { supabase, todayInNewYork, formatDay, type Word } from "@/lib/supabase";
import { ENGLISH } from "@/lib/languages";
import { Loading, ErrorMessage } from "@/components/Status";
import LanguagePicker, { useLanguage } from "@/components/LanguagePicker";
import type { TranslatedWord } from "@/app/api/translate/route";

type Translation =
  | { status: "done"; data: TranslatedWord }
  | { status: "error"; message: string };

export default function Home() {
  const [word, setWord] = useState<Word | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [lang, setLang] = useLanguage();
  const [translations, setTranslations] = useState<Record<string, Translation>>({});

  useEffect(() => {
    // Read the date on the client (not at prerender time) so it's always the visitor's today.
    const today = todayInNewYork();
    supabase
      .from("words")
      .select("*")
      .eq("day", today)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        setToday(today);
        setWord(data);
      });
  }, []);

  const wordId = word?.id;
  const current = translations[lang.code];
  useEffect(() => {
    if (wordId === undefined || lang.code === ENGLISH.code || current) return;
    const code = lang.code;
    fetch(`/api/translate?id=${wordId}&lang=${encodeURIComponent(code)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        setTranslations((t) => ({ ...t, [code]: { status: "done", data: body } }));
      })
      .catch((e: Error) =>
        setTranslations((t) => ({ ...t, [code]: { status: "error", message: e.message } })),
      );
  }, [wordId, lang.code, current]);

  if (error) return <ErrorMessage message={error} />;
  if (word === undefined || !today) return <Loading />;

  const isEnglish = lang.code === ENGLISH.code;
  const shown: TranslatedWord | null =
    !word ? null : isEnglish ? word : current?.status === "done" ? current.data : null;

  return (
    <article>
      <p className="text-sm font-medium uppercase tracking-widest text-amber-700">
        {formatDay(today)}
      </p>
      {word ? (
        <>
          <div className="mt-6">
            <LanguagePicker value={lang} onChange={setLang} />
          </div>

          {!isEnglish && current?.status === "error" && (
            <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Couldn&rsquo;t translate into {lang.name} right now ({current.message}). Try again
              later.
            </p>
          )}

          {shown ? (
            <div lang={lang.code} dir={lang.rtl ? "rtl" : "ltr"} className="mt-8">
              <h1 className="break-words font-serif text-5xl font-semibold tracking-tight sm:text-6xl">
                {shown.word}
              </h1>
              <p className="mt-2 font-serif text-lg italic text-stone-500">
                {shown.part_of_speech}
                {!isEnglish && (
                  <span lang="en" dir="ltr" className="not-italic">
                    {" "}
                    &middot; English: <span className="italic">{word.word}</span>
                  </span>
                )}
              </p>
              <p lang="en" dir="ltr" className="mt-8 text-xl leading-relaxed text-stone-800">
                {shown.definition}
              </p>
              {shown.example && (
                <blockquote
                  className={`mt-8 font-serif text-lg italic leading-relaxed text-stone-600 ${
                    lang.rtl ? "border-r-4 pr-4" : "border-l-4 pl-4"
                  } border-amber-400`}
                >
                  &ldquo;{shown.example}&rdquo;
                </blockquote>
              )}
            </div>
          ) : current?.status === "error" ? null : (
            <p className="mt-8 text-stone-500" aria-live="polite">
              Translating into {lang.name}&hellip;
            </p>
          )}
        </>
      ) : (
        <p className="mt-6 text-lg text-stone-600">No word has been scheduled for today yet.</p>
      )}
    </article>
  );
}
