"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, todayInNewYork, formatDay, type Word } from "@/lib/supabase";
import { ENGLISH } from "@/lib/languages";
import { Loading, ErrorMessage } from "@/components/Status";
import LanguagePicker, { useLanguage } from "@/components/LanguagePicker";
import { useAccount } from "@/components/Account";
import type { PersonalWordResponse } from "@/app/api/personal-word/route";

/** Say the word aloud with the browser's built-in voice for its language. */
function pronounce(word: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = lang;
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

type Result ={ status: "done"; data: PersonalWordResponse } | { status: "error"; message: string };

export default function Home() {
  const { account } = useAccount();
  const [today] = useState(todayInNewYork);
  const [shared, setShared] = useState<Word | null | undefined>(undefined);
  const [lang, setLang] = useLanguage();
  const [results, setResults] = useState<Record<string, Result>>({});

  const hobbies = account.hobbies ?? [];
  const hobbyKey = [...hobbies].sort().join("|");
  const key = `${hobbyKey}#${lang.code}`;
  const current = results[key];

  useEffect(() => {
    supabase
      .from("words")
      .select("*")
      .eq("day", today)
      .maybeSingle()
      .then(({ data }) => setShared(data ?? null));
  }, [today]);

  useEffect(() => {
    if (!hobbyKey || current) return;
    const params = new URLSearchParams({ day: today, lang: lang.code });
    hobbyKey.split("|").forEach((h) => params.append("hobby", h));
    fetch(`/api/personal-word?${params}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        setResults((r) => ({ ...r, [key]: { status: "done", data: body } }));
      })
      .catch((e: Error) =>
        setResults((r) => ({ ...r, [key]: { status: "error", message: e.message } })),
      );
  }, [hobbyKey, today, lang.code, key, current]);

  const isEnglish = lang.code === ENGLISH.code;
  const shown = current?.status === "done" ? current.data : null;

  return (
    <article className="animate-rise">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-accent">{formatDay(today)}</p>
          <p className="mt-2 font-serif text-2xl italic text-stone-600">Your word for today</p>
        </div>
        <LanguagePicker value={lang} onChange={setLang} />
      </header>

      {current?.status === "error" ? (
        <div className="mt-8">
          <ErrorMessage message={current.message} />
        </div>
      ) : !shown ? (
        <div className="card mt-6">
          <Loading />
        </div>
      ) : (
        <div
          key={key}
          lang={lang.code}
          dir={lang.rtl ? "rtl" : "ltr"}
          className="card animate-rise relative mt-6 overflow-hidden px-6 py-8 sm:px-10 sm:py-12"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-amber-200/40 blur-3xl"
          />
          <p lang="en" dir="ltr" className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
              <span aria-hidden>✦</span> Picked for your love of {shown.hobby}
            </span>
          </p>

          <h1 className="relative mt-6 break-words font-serif text-5xl leading-[1.05] font-semibold tracking-tight sm:text-7xl">
            {shown.word}
          </h1>

          <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={() => pronounce(shown.word, lang.code)}
              title="Hear it pronounced"
              className="group inline-flex items-center gap-2 rounded-full bg-white py-1.5 ps-1.5 pe-4 ring-1 ring-stone-200 transition hover:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="grid size-7 place-items-center rounded-full bg-ink text-stone-50 transition group-hover:bg-accent">
                <SpeakerIcon />
              </span>
              {shown.phonetic ? (
                <span
                  lang={lang.code.startsWith("zh") ? "zh-Latn-pinyin" : undefined}
                  className="text-lg tracking-wide text-stone-700"
                >
                  {shown.phonetic}
                </span>
              ) : (
                <span lang="en" dir="ltr" className="text-sm font-medium text-stone-700">
                  Hear it
                </span>
              )}
            </button>
            <span className="font-serif text-lg italic text-stone-500">{shown.part_of_speech}</span>
            {!isEnglish && (
              <span lang="en" dir="ltr" className="text-sm text-stone-500">
                English: <span className="font-serif text-base italic text-stone-700">{shown.english}</span>
              </span>
            )}
          </div>

          <hr className="relative my-8 border-stone-200" />

          <p lang="en" dir="ltr" className="relative text-xl leading-relaxed text-stone-800 sm:text-2xl">
            {shown.definition}
          </p>
          {shown.example && (
            <blockquote
              className={`relative mt-8 rounded-xl bg-stone-50 px-5 py-4 font-serif text-lg italic leading-relaxed text-stone-600 ring-1 ring-stone-200/70 ${
                lang.rtl ? "border-r-4" : "border-l-4"
              } border-accent`}
            >
              &ldquo;{shown.example}&rdquo;
            </blockquote>
          )}
        </div>
      )}

      {shared && (
        <aside className="card mt-8 grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="eyebrow">Everyone&rsquo;s word today</p>
            <p className="mt-2">
              <span className="font-serif text-2xl font-semibold">{shared.word}</span>{" "}
              <span className="font-serif italic text-stone-500">{shared.part_of_speech}</span>
            </p>
            <p className="mt-1 text-stone-700">{shared.definition}</p>
            <p className="mt-3 text-sm text-stone-500">
              The quiz uses these shared
              words.
            </p>
          </div>
          <Link href="/quiz" className="btn-primary">
            Take the quiz &rarr;
          </Link>
        </aside>
      )}
    </article>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
