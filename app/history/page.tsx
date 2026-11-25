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
    <section>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Past words</h1>
      {rows.length === 0 ? (
        <p className="mt-6 text-stone-600">No past words yet. Check back tomorrow.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {rows.map((w) => (
            <li key={w.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-serif text-xl font-semibold">
                  {w.word}{" "}
                  <span className="text-base font-normal italic text-stone-500">{w.part_of_speech}</span>
                </h2>
                <time className="text-xs uppercase tracking-wide text-stone-500" dateTime={w.day}>
                  {formatDay(w.day, { weekday: undefined, month: "short" })}
                </time>
              </div>
              <p className="mt-1 text-stone-700">{w.definition}</p>
              <p className="mt-2 text-sm">
                {w.total === 0 ? (
                  <span className="text-stone-400">Not quizzed yet</span>
                ) : (
                  <span
                    className={
                      w.right === w.total
                        ? "text-emerald-700"
                        : w.right === 0
                          ? "text-red-700"
                          : "text-amber-700"
                    }
                  >
                    Right {w.right} of {w.total} {w.total === 1 ? "time" : "times"}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
