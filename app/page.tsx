"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase, todayInNewYork, formatDay, type Word } from "@/lib/supabase";
import { ENGLISH } from "@/lib/languages";
import { Loading, ErrorMessage } from "@/components/Status";
import LanguagePicker, { useLanguage } from "@/components/LanguagePicker";
import SuggestButton from "@/components/SuggestButton";
import ShareButton from "@/components/ShareButton";
import { useAccount } from "@/components/Account";
import { DailyGoals } from "@/components/Game";
import { noteHeard } from "@/lib/xp";
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
  const cardRef = useRef<HTMLDivElement>(null);

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="chip bg-white text-orange-600 ring-2 ring-orange-200">
            <span aria-hidden>📅</span> {formatDay(today)}
          </p>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Your word for today
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton word={shown} cardRef={cardRef} />
          <SuggestButton />
          <LanguagePicker value={lang} onChange={setLang} />
        </div>
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
          ref={cardRef}
          lang={lang.code}
          dir={lang.rtl ? "rtl" : "ltr"}
          className="card animate-rise mt-6 overflow-hidden"
        >
          {/* The word itself, on a bright banner. */}
          <div className="relative overflow-hidden bg-linear-to-br from-orange-400 via-orange-500 to-orange-600 px-6 pt-7 pb-8 text-white sm:px-10 sm:pt-9 sm:pb-10">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-yellow-300/45 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-orange-700/40 blur-3xl"
            />
            <span aria-hidden className="pointer-events-none absolute top-6 right-8 text-5xl opacity-25 select-none sm:text-7xl">
              ✦
            </span>

            <p lang="en" dir="ltr" className="relative">
              <span className="chip bg-white/20 text-white ring-1 ring-white/40 backdrop-blur-sm">
                <span aria-hidden>✨</span> Picked for your love of {shown.hobby}
              </span>
            </p>

            <h2 className="relative mt-5 font-serif text-5xl leading-[1.02] font-semibold tracking-tight break-words [text-shadow:0_3px_0_rgb(0_0_0/0.12)] sm:text-7xl">
              {shown.word}
            </h2>

            <div className="relative mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <button
                type="button"
                onClick={() => {
                  pronounce(shown.word, lang.code);
                  noteHeard();
                }}
                title="Hear it pronounced"
                className="group inline-flex items-center gap-2.5 rounded-2xl bg-white py-1.5 ps-1.5 pe-4 text-orange-700 shadow-[0_4px_0_0_rgb(0_0_0/0.15)] transition hover:-translate-y-px active:translate-y-[3px] active:shadow-[0_1px_0_0_rgb(0_0_0/0.15)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="grid size-8 place-items-center rounded-xl bg-orange-500 text-white transition group-hover:scale-110">
                  <SpeakerIcon />
                </span>
                {shown.phonetic ? (
                  <span
                    lang={lang.code.startsWith("zh") ? "zh-Latn-pinyin" : undefined}
                    className="text-lg font-bold tracking-wide"
                  >
                    {shown.phonetic}
                  </span>
                ) : (
                  <span lang="en" dir="ltr" className="text-sm font-extrabold">
                    Hear it
                  </span>
                )}
              </button>
              <span className="chip bg-black/15 text-sm text-white">{shown.part_of_speech}</span>
              {!isEnglish && (
                <span lang="en" dir="ltr" className="chip bg-black/15 text-sm text-white">
                  English: {shown.english}
                </span>
              )}
            </div>
          </div>

          {/* What it means. */}
          <div className="px-6 py-7 sm:px-10 sm:py-9">
            <p lang="en" dir="ltr" className="eyebrow text-orange-600">
              Meaning
            </p>
            <p lang="en" dir="ltr" className="mt-2 text-xl leading-relaxed font-semibold text-stone-800 sm:text-2xl">
              {shown.definition}
            </p>
            {shown.example && (
              <blockquote className="relative mt-6 rounded-2xl bg-yellow-50 px-5 py-4 text-lg leading-relaxed font-semibold text-stone-700 ring-2 ring-yellow-200">
                <span
                  aria-hidden
                  className="absolute -top-3 start-4 rounded-full bg-yellow-300 px-2.5 py-0.5 text-xs font-extrabold text-yellow-900"
                >
                  In a sentence
                </span>
                &ldquo;{shown.example}&rdquo;
              </blockquote>
            )}
          </div>
        </div>
      )}

      {shown && <DailyGoals />}

      {shared && (
        <aside className="card mt-8 flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-orange-100 text-3xl ring-2 ring-orange-200"
          >
            🌍
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Everyone&rsquo;s word today</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="font-serif text-2xl font-semibold">{shared.word}</span>
              <span className="text-sm font-bold text-stone-400">{shared.part_of_speech}</span>
            </p>
            <p className="mt-1 font-semibold text-stone-600">{shared.definition}</p>
          </div>
          <Link href="/quiz" className="btn-primary shrink-0">
            Take the quiz
          </Link>
        </aside>
      )}
    </article>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
