"use client";

import { useEffect, useState } from "react";
import { supabase, todayInNewYork, formatDay, type Word } from "@/lib/supabase";
import { Loading, ErrorMessage } from "@/components/Status";

export default function Home() {
  const [word, setWord] = useState<Word | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);

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

  if (error) return <ErrorMessage message={error} />;
  if (word === undefined || !today) return <Loading />;

  return (
    <article>
      <p className="text-sm font-medium uppercase tracking-widest text-amber-700">
        {formatDay(today)}
      </p>
      {word ? (
        <>
          <h1 className="mt-3 break-words font-serif text-5xl font-semibold tracking-tight sm:text-6xl">
            {word.word}
          </h1>
          <p className="mt-2 font-serif text-lg italic text-stone-500">{word.part_of_speech}</p>
          <p className="mt-8 text-xl leading-relaxed text-stone-800">{word.definition}</p>
          {word.example && (
            <blockquote className="mt-8 border-l-4 border-amber-400 pl-4 font-serif text-lg italic leading-relaxed text-stone-600">
              &ldquo;{word.example}&rdquo;
            </blockquote>
          )}
        </>
      ) : (
        <p className="mt-6 text-lg text-stone-600">No word has been scheduled for today yet.</p>
      )}
    </article>
  );
}
