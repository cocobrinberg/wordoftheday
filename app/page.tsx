"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, todayInNewYork, formatDay, type Word } from "@/lib/supabase";
import { ENGLISH } from "@/lib/languages";
import { Loading, ErrorMessage } from "@/components/Status";
import LanguagePicker, { useLanguage } from "@/components/LanguagePicker";
import { useAccount } from "@/components/Account";
import type { PersonalWordResponse } from "@/app/api/personal-word/route";

type Result = { status: "done"; data: PersonalWordResponse } | { status: "error"; message: string };

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
    <article>
      <p className="text-sm font-medium uppercase tracking-widest text-amber-700">
        {formatDay(today)}
      </p>

      <div className="mt-6">
        <LanguagePicker value={lang} onChange={setLang} />
      </div>

      {current?.status === "error" ? (
        <div className="mt-8">
          <ErrorMessage message={current.message} />
        </div>
      ) : !shown ? (
        <div className="mt-8">
          <Loading />
        </div>
      ) : (
        <div lang={lang.code} dir={lang.rtl ? "rtl" : "ltr"} className="mt-8">
          <p lang="en" dir="ltr" className="text-sm text-stone-500">
            Picked for your love of <span className="font-medium text-stone-800">{shown.hobby}</span>
          </p>
          <h1 className="mt-2 break-words font-serif text-5xl font-semibold tracking-tight sm:text-6xl">
            {shown.word}
          </h1>
          {shown.pinyin && (
            <p lang="zh-Latn-pinyin" className="mt-2 text-2xl tracking-wide text-amber-700">
              {shown.pinyin}
            </p>
          )}
          <p className="mt-2 font-serif text-lg italic text-stone-500">
            {shown.part_of_speech}
            {!isEnglish && (
              <span lang="en" dir="ltr" className="not-italic">
                {" "}
                &middot; English: <span className="italic">{shown.english}</span>
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
      )}

      {shared && (
        <aside className="mt-12 rounded-xl border border-stone-200 bg-white/60 p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-500">
            Everyone&rsquo;s word today
          </p>
          <p className="mt-1">
            <span className="font-serif text-xl font-semibold">{shared.word}</span>{" "}
            <span className="font-serif italic text-stone-500">{shared.part_of_speech}</span>
          </p>
          <p className="mt-1 text-stone-700">{shared.definition}</p>
          <p className="mt-2 text-sm text-stone-500">
            The <Link href="/quiz" className="underline underline-offset-2">quiz</Link> and{" "}
            <Link href="/history" className="underline underline-offset-2">history</Link> use
            these shared words.
          </p>
        </aside>
      )}
    </article>
  );
}
