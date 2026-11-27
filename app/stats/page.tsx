"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchAttempts,
  fetchLeaderboard,
  fetchWordsThroughToday,
  onAttemptSaved,
  type Attempt,
  type LeaderboardRow,
  type Word,
} from "@/lib/supabase";
import { Loading, ErrorMessage } from "@/components/Status";
import { useAccount } from "@/components/Account";
import { Flame, StreakCard, StreakChip } from "@/components/Streak";
import { Badges, LevelCard } from "@/components/Game";
import { fetchStreaks, type StreakRow } from "@/lib/streak";

/** How often the open Stats page reloads the leaderboard. */
const BOARD_REFRESH_MS = 10_000;

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
    const w = a.word_id === null ? undefined : byId.get(a.word_id);
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
    streaks: StreakRow[] | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reloads every time the page is shown (this page stays mounted in the
  // background between tabs), and again after each quiz answer.
  useEffect(() => {
    let live = true;
    const loadBoards = () =>
      Promise.all([fetchLeaderboard(), fetchStreaks()]).then(([board, streaks]) => {
        if (live) setData((d) => d && { ...d, board, streaks });
      });

    Promise.all([fetchWordsThroughToday(), fetchAttempts(token), fetchLeaderboard(), fetchStreaks()])
      .then(([words, attempts, board, streaks]) => {
        if (live) setData({ words, attempts, board, streaks });
      })
      .catch((e) => live && setError(e.message ?? String(e)));

    const stop = onAttemptSaved((saved) => {
      // Your own scores change at once; the shared boards follow from the database.
      setData((d) =>
        d && !d.attempts.some((a) => a.id === saved.id) ? { ...d, attempts: [...d.attempts, saved] } : d,
      );
      loadBoards().catch(() => {});
    });

    // Other players' answers show up on their own while this page is open.
    const refresh = () => {
      if (document.visibilityState === "visible") loadBoards().catch(() => {});
    };
    const timer = setInterval(refresh, BOARD_REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      stop();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [token]);

  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;

  const { overall, areas, practice } = summarize(data.words, data.attempts);

  return (
    <div className="animate-rise space-y-14">
      <section aria-labelledby="mine">
        <p className="eyebrow text-accent">Progress</p>
        <h1 id="mine" className="page-title mt-2">
          Your stats
        </h1>

        <div className="mt-8">
          <div className="grid gap-4">
            <LevelCard />
            <StreakCard />
          </div>
        </div>

        {overall.total === 0 ? (
          <div className="card mt-8 p-6 text-stone-600">
            You haven&rsquo;t answered any quiz questions yet.{" "}
            <Link href="/quiz" className="link">
              Take the quiz
            </Link>{" "}
            to see your scores here.
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="card p-6">
                <p className="eyebrow">
                  Answered correctly
                </p>
                <p className={`mt-2 font-serif text-6xl font-semibold tabular-nums ${tone(pct(overall)).text}`}>
                  {fmt(pct(overall))}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {overall.right} of {overall.total} questions
                </p>
              </div>
              {areas.length > 0 && (
                <div className="card p-6">
                  <p className="eyebrow">
                    {areas.length > 1 ? "Weakest area" : "Only area so far"}
                  </p>
                  <p className="mt-2 font-serif text-4xl font-semibold">{areas[0].name}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {fmt(pct(areas[0]))} right ({areas[0].right} of {areas[0].total})
                  </p>
                </div>
              )}
            </div>

            <h2 className="mt-10 eyebrow">
              By part of speech
            </h2>
            <ul className="mt-3 card divide-y divide-stone-200/70">
              {areas.map((a, i) => {
                const p = pct(a);
                const t = tone(p);
                return (
                  <li key={a.name} className="p-5">
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
                      className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-stone-100"
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
                <h2 className="mt-10 eyebrow">
                  Words to practice
                </h2>
                <ul className="mt-3 card divide-y divide-stone-200/70">
                  {practice.map(({ word, right, total }) => (
                    <li key={word.id} className="flex items-baseline justify-between gap-3 p-5">
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

      <Badges />

      {data.board && (
        <Leaderboard rows={data.board} streaks={data.streaks} me={account.username} />
      )}
    </div>
  );
}

function rankClass(rank: number) {
  return rank === 1
    ? "bg-yellow-300 text-yellow-950"
    : rank === 2
      ? "bg-stone-300 text-stone-800"
      : rank === 3
        ? "bg-orange-200 text-orange-900"
        : "text-stone-400";
}

/** Standard competition ranking: equal entries share a rank. */
function ranks<T>(rows: T[], same: (a: T, b: T) => boolean) {
  const out: number[] = [];
  rows.forEach((r, i) => out.push(i > 0 && same(rows[i - 1], r) ? out[i - 1] : i + 1));
  return out;
}

function Leaderboard({
  rows,
  streaks,
  me,
}: {
  rows: LeaderboardRow[];
  streaks: StreakRow[] | null;
  me: string;
}) {
  const [view, setView] = useState<"accuracy" | "streaks">("accuracy");
  // Everyone is listed. Anyone who has answered at least one question is
  // ranked by accuracy; people with no answers yet follow, unranked.
  const all = rows.some((r) => r.username === me)
    ? rows
    : [...rows, { username: me, right_count: 0, total: 0, percent: 0 }];
  const ranked = all
    .filter((r) => r.total > 0)
    .sort((a, b) => b.percent - a.percent || b.total - a.total || a.username.localeCompare(b.username));
  const unranked = all
    .filter((r) => r.total === 0)
    .sort((a, b) => a.username.localeCompare(b.username));
  const everyone = [...ranked, ...unranked];
  const rk = ranks(ranked, (a, b) => a.percent === b.percent && a.total === b.total);
  const mine = all.find((r) => r.username === me);
  const noAnswers = (mine?.total ?? 0) === 0;
  const streakOf = new Map((streaks ?? []).map((s) => [s.username, s]));
  const onFire = (streaks ?? []).filter((s) => s.current_streak > 0);
  const showStreaks = streaks !== null && view === "streaks";

  return (
    <section aria-labelledby="board">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="board" className="font-serif text-4xl font-semibold tracking-tight">
            Leaderboard
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {showStreaks
              ? "Everyone with a streak going, ranked by days in a row."
              : "Everyone playing, ranked by percentage right. Updates live."}
          </p>
        </div>
        {streaks !== null && (
          <div
            role="tablist"
            aria-label="Rank by"
            className="flex rounded-full bg-white/70 p-1 text-sm ring-1 ring-black/[0.06] shadow-sm"
          >
            {(["accuracy", "streaks"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                  view === v ? "bg-ink text-stone-50 shadow-sm" : "text-stone-600 hover:text-ink"
                }`}
              >
                {v === "streaks" && <Flame className="size-4" />}
                {v === "accuracy" ? "Accuracy" : "Streaks"}
              </button>
            ))}
          </div>
        )}
      </div>

      {showStreaks ? (
        onFire.length === 0 ? (
          <p className="card mt-5 p-6 text-center text-stone-600">
            Nobody has a streak going. Answer a quiz question to be the first!
          </p>
        ) : (
          <StreakBoard rows={onFire} me={me} />
        )
      ) : (
        <>
          {noAnswers && <p className="alert-note mt-5">Answer a quiz question to get a rank.</p>}
          {everyone.length === 0 ? (
            <p className="card mt-5 p-6 text-center text-stone-600">Nobody is on the leaderboard yet.</p>
          ) : (
            <ol className="mt-5 card overflow-hidden divide-y divide-stone-200/70">
              {everyone.map((r, i) => {
                const isMe = r.username === me;
                const rank = i < ranked.length ? rk[i] : null;
                return (
                  <li
                    key={r.username}
                    className={`flex items-center gap-4 px-5 py-3.5 ${isMe ? "bg-accent-soft/70" : ""} ${
                      rank === null ? "text-stone-500" : ""
                    }`}
                    aria-current={isMe ? "true" : undefined}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full font-serif text-base font-semibold ${
                        rank === null ? "text-stone-300" : rankClass(rank)
                      }`}
                      aria-label={rank === null ? "Not ranked yet" : `Rank ${rank}`}
                    >
                      {rank ?? "–"}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={`truncate font-medium ${rank === null ? "" : "text-ink"}`}>
                        {r.username}
                      </span>
                      {isMe && <span className="text-sm font-normal text-stone-500">(you)</span>}
                      <StreakChip days={streakOf.get(r.username)?.current_streak ?? 0} />
                    </span>
                    <span className="text-right">
                      {rank === null ? (
                        <span className="block text-xs">No answers yet</span>
                      ) : (
                        <span className="block font-semibold tabular-nums">{fmt(r.percent)}</span>
                      )}
                      <span className="block text-xs text-stone-500">
                        {r.right_count}/{r.total}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function StreakBoard({ rows, me }: { rows: StreakRow[]; me: string }) {
  const rk = ranks(rows, (a, b) => a.current_streak === b.current_streak);
  const top = rows[0].current_streak;
  return (
    <ol className="mt-5 card overflow-hidden divide-y divide-stone-200/70">
      {rows.map((r, i) => {
        const isMe = r.username === me;
        return (
          <li
            key={r.username}
            className={`flex items-center gap-4 px-5 py-3.5 ${isMe ? "bg-accent-soft/70" : ""}`}
            aria-current={isMe ? "true" : undefined}
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full font-serif text-base font-semibold ${rankClass(rk[i])}`}
            >
              {rk[i]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {r.username}
                {isMe && <span className="ml-2 text-sm font-normal text-stone-500">(you)</span>}
              </span>
              <span
                className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-stone-100"
                aria-hidden
              >
                <span
                  className="block h-full rounded-full bg-linear-to-r from-yellow-400 via-orange-500 to-orange-700"
                  style={{ width: `${(100 * r.current_streak) / top}%` }}
                />
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-right">
              <Flame className={`size-6 ${rk[i] === 1 ? "animate-flicker" : ""}`} />
              <span>
                <span className="block font-serif text-xl leading-none font-semibold tabular-nums">
                  {r.current_streak}
                </span>
                <span className="block text-xs text-stone-500">best {r.best_streak}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
