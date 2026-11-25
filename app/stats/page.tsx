"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchAttempts,
  fetchLeaderboard,
  fetchPastWords,
  type Attempt,
  type LeaderboardRow,
  type Word,
} from "@/lib/supabase";
import { Loading, ErrorMessage } from "@/components/Status";
import { useAccount } from "@/components/Account";

/** Answers needed before someone shows up on the leaderboard. */
const MIN_TO_RANK = 5;

type Tally = { right: number; total: number };
type Area = Tally & { name: string };
type WordTally = Tally & { word: Word };

const pct = (t: Tally) => (t.total ? (100 * t.right) / t.total : 0);
const fmt = (n: number) => `${Math.round(n)}%`;

/** "adjective" -> "Adjectives" */
function plural(pos: string) {
  const p = pos.trim().toLowerCase() || "other";
  const s = p.endsWith("s") ? p : `${p}s`;
  return s[0].toUpperCase() + s.slice(1);
}

function tone(percent: number) {
  if (percent >= 80) return { bar: "bg-emerald-500", text: "text-emerald-700" };
  if (percent >= 50) return { bar: "bg-amber-400", text: "text-amber-700" };
  return { bar: "bg-rose-500", text: "text-rose-700" };
}

function summarize(words: Word[], attempts: Attempt[]) {
  const byId = new Map(words.map((w) => [w.id, w]));
  const overall: Tally = { right: 0, total: 0 };
  const areas = new Map<string, Area>();
  const perWord = new Map<number, WordTally>();
  for (const a of attempts) {
    const w = byId.get(a.word_id);
    if (!w) continue; // word isn't in the quiz pool any more
    const add = (t: Tally) => {
      t.total++;
      if (a.correct) t.right++;
    };
    add(overall);
    const name = plural(w.part_of_speech);
    if (!areas.has(name)) areas.set(name, { name, right: 0, total: 0 });
    add(areas.get(name)!);
    if (!perWord.has(w.id)) perWord.set(w.id, { word: w, right: 0, total: 0 });
    add(perWord.get(w.id)!);
  }
  // Weakest first; with a tie, the one answered more often comes first.
  const sortedAreas = [...areas.values()].sort((a, b) => pct(a) - pct(b) || b.total - a.total);
  const practice = [...perWord.values()]
    .filter((t) => t.right < t.total)
    .sort((a, b) => pct(a) - pct(b) || b.total - a.total)
    .slice(0, 3);
  return { overall, areas: sortedAreas, practice };
}

export default function Stats() {
  const { account, token } = useAccount();
  const [data, setData] = useState<{
    words: Word[];
    attempts: Attempt[];
    board: LeaderboardRow[] | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchPastWords(), fetchAttempts(token), fetchLeaderboard()])
      .then(([words, attempts, board]) => setData({ words, attempts, board }))
      .catch((e) => setError(e.message ?? String(e)));
  }, [token]);

  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;

  const { overall, areas, practice } = summarize(data.words, data.attempts);

  return (
    <div className="space-y-12">
      <section aria-labelledby="mine">
        <h1 id="mine" className="font-serif text-3xl font-semibold tracking-tight">
          Your stats
        </h1>

        {overall.total === 0 ? (
          <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
            You haven&rsquo;t answered any quiz questions yet.{" "}
            <Link href="/quiz" className="font-medium text-stone-900 underline underline-offset-2">
              Take the quiz
            </Link>{" "}
            to see your scores here.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-stone-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-stone-500">
                  Answered correctly
                </p>
                <p className={`mt-1 font-serif text-5xl font-semibold ${tone(pct(overall)).text}`}>
                  {fmt(pct(overall))}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {overall.right} of {overall.total} questions
                </p>
              </div>
              {areas.length > 0 && (
                <div className="rounded-xl border border-stone-200 bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-500">
                    {areas.length > 1 ? "Weakest area" : "Only area so far"}
                  </p>
                  <p className="mt-1 font-serif text-3xl font-semibold">{areas[0].name}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {fmt(pct(areas[0]))} right ({areas[0].right} of {areas[0].total})
                  </p>
                </div>
              )}
            </div>

            <h2 className="mt-8 text-xs font-medium uppercase tracking-widest text-stone-500">
              By part of speech
            </h2>
            <ul className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
              {areas.map((a, i) => {
                const p = pct(a);
                const t = tone(p);
                return (
                  <li key={a.name} className="p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {a.name}
                        {i === 0 && areas.length > 1 && (
                          <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                            Weakest
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-stone-600">
                        <span className={`font-semibold ${t.text}`}>{fmt(p)}</span> &middot; {a.right}/
                        {a.total}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100"
                      role="img"
                      aria-label={`${a.name}: ${fmt(p)} correct`}
                    >
                      <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${p}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>

            {practice.length > 0 && (
              <>
                <h2 className="mt-8 text-xs font-medium uppercase tracking-widest text-stone-500">
                  Words to practice
                </h2>
                <ul className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
                  {practice.map(({ word, right, total }) => (
                    <li key={word.id} className="flex items-baseline justify-between gap-3 p-4">
                      <span>
                        <span className="font-serif text-lg font-semibold">{word.word}</span>{" "}
                        <span className="text-sm italic text-stone-500">{word.part_of_speech}</span>
                      </span>
                      <span className="shrink-0 text-sm text-stone-600">
                        Right {right} of {total}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {data.board && <Leaderboard rows={data.board} me={account.username} />}
    </div>
  );
}

function Leaderboard({ rows, me }: { rows: LeaderboardRow[]; me: string }) {
  const ranked = rows.filter((r) => r.total >= MIN_TO_RANK);
  const mine = rows.find((r) => r.username === me);
  const needed = MIN_TO_RANK - (mine?.total ?? 0);

  return (
    <section aria-labelledby="board">
      <h2 id="board" className="font-serif text-3xl font-semibold tracking-tight">
        Leaderboard
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        Everyone who has answered at least {MIN_TO_RANK} questions, ranked by percentage right.
      </p>

      {needed > 0 && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Answer {needed} more {needed === 1 ? "question" : "questions"} to join the leaderboard.
        </p>
      )}

      {ranked.length === 0 ? (
        <p className="mt-6 text-stone-600">Nobody is on the leaderboard yet.</p>
      ) : (
        <ol className="mt-4 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {ranked.map((r, i) => {
            // Same percentage and same number of answers share a rank.
            let rank = i + 1;
            while (
              rank > 1 &&
              ranked[rank - 2].percent === r.percent &&
              ranked[rank - 2].total === r.total
            )
              rank--;
            const isMe = r.username === me;
            return (
              <li
                key={r.username}
                className={`flex items-center gap-4 px-4 py-3 ${isMe ? "bg-amber-50" : ""}`}
                aria-current={isMe ? "true" : undefined}
              >
                <span
                  className={`w-7 text-right font-serif text-lg font-semibold ${
                    rank <= 3 ? "text-amber-700" : "text-stone-400"
                  }`}
                >
                  {rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {r.username}
                  {isMe && <span className="ml-2 text-sm font-normal text-stone-500">(you)</span>}
                </span>
                <span className="text-right">
                  <span className="block font-semibold">{fmt(r.percent)}</span>
                  <span className="block text-xs text-stone-500">
                    {r.right_count}/{r.total}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
