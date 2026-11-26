"use client";

import { useEffect, useState } from "react";
import { fetchAttempts, fetchPastWords, formatDay, type Word } from "@/lib/supabase";
import { Loading, ErrorMessage } from "@/components/Status";
import { useAccount } from "@/components/Account";

type Row = Word & { right: number; total: number };

export default function History() {
  const { token } = useAccount();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchPastWords(), fetchAttempts(token)])
      .then(([words, attempts]) =>
        setRows(
          words.map((w) => {
            const mine = attempts.filter((a) => a.word_id === w.id);
            return { ...w, right: mine.filter((a) => a.correct).length, total: mine.length };
          }),
        ),
      )
      .catch((e) => setError(e.message ?? String(e)));
  }, [token]);

  if (error) return <ErrorMessage message={error} />;
  if (!rows) return <Loading />;

  return (
    <section className="animate-rise">
      <p className="eyebrow text-accent">Archive</p>
      <h1 className="page-title mt-2">Past words</h1>
      {rows.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-stone-600">
          No past words yet. Check back tomorrow.
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((w) => {
            const month = formatDay(w.day, { weekday: undefined, day: undefined, year: undefined, month: "short" });
            const day = Number(w.day.slice(8, 10));
            const tone =
              w.total === 0
                ? "bg-stone-100 text-stone-500 ring-stone-200"
                : w.right === w.total
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : w.right === 0
                    ? "bg-rose-50 text-rose-800 ring-rose-200"
                    : "bg-amber-50 text-amber-800 ring-amber-200";
            return (
              <li key={w.id} className="card flex gap-4 p-5 sm:gap-6 sm:p-6">
                <time
                  dateTime={w.day}
                  className="flex w-12 shrink-0 flex-col items-center self-start rounded-xl bg-stone-100 py-1.5 text-center"
                >
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-accent">
                    {month}
                  </span>
                  <span className="font-serif text-xl leading-none font-semibold">{day}</span>
                </time>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <h2 className="font-serif text-2xl font-semibold">
                      {w.word}{" "}
                      <span className="text-base font-normal italic text-stone-500">
                        {w.part_of_speech}
                      </span>
                    </h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${tone}`}>
                      {w.total === 0 ? "Not quizzed yet" : `${w.right} / ${w.total} right`}
                    </span>
                  </div>
                  <p className="mt-1.5 leading-relaxed text-stone-700">{w.definition}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
