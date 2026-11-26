"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { todayInNewYork } from "@/lib/supabase";
import { clearStreak, loadStreak, shiftDay, useStreak, type Streak } from "@/lib/streak";

/** Loads the signed-in player's streak into the shared store. */
export function StreakSync({ token }: { token: string }) {
  useEffect(() => {
    loadStreak(token).catch(() => {});
    return clearStreak;
  }, [token]);
  return null;
}

type FlameState = "lit" | "waiting" | "out";

function flameState(s: Pick<Streak, "current" | "playedToday">): FlameState {
  if (s.current === 0) return "out";
  return s.playedToday ? "lit" : "waiting";
}

export function Flame({ state = "lit", className = "" }: { state?: FlameState; className?: string }) {
  // Unique per icon: many flames share a page, and a gradient that lives in a
  // hidden copy (like the header badge on phones) would leave the others blank.
  const id = `flame-${useId().replace(/:/g, "")}`;
  const [outer, inner] =
    state === "lit"
      ? [["#fbbf24", "#f97316", "#dc2626"], ["#fef9c3", "#fde047"]]
      : state === "waiting"
        ? [["#fed7aa", "#fdba74", "#fb923c"], ["#fff7ed", "#ffedd5"]]
        : [["#e7e5e4", "#d6d3d1", "#a8a29e"], ["#fafaf9", "#f5f5f4"]];
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}-o`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={outer[0]} />
          <stop offset=".55" stopColor={outer[1]} />
          <stop offset="1" stopColor={outer[2]} />
        </linearGradient>
        <linearGradient id={`${id}-i`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={inner[0]} />
          <stop offset="1" stopColor={inner[1]} />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id}-o)`}
        d="M12.6 1.8c.4 2.9-1 4.6-2.6 6.4C8.3 10 6.4 12 6.4 15.1A5.6 5.6 0 0 0 12 21.6a5.8 5.8 0 0 0 5.8-5.9c0-2.2-.9-3.7-1.9-5 .1 1.6-.5 2.8-1.6 3.4.5-4.4-.6-8.3-1.7-12.3Z"
      />
      <path
        fill={`url(#${id}-i)`}
        d="M12.3 11.6c.3 1.7-.5 2.6-1.3 3.5-.7.8-1.3 1.6-1.3 2.8a2.4 2.4 0 0 0 2.4 2.4 2.5 2.5 0 0 0 2.5-2.6c0-1-.4-1.7-.9-2.3 0 .7-.3 1.2-.8 1.5.2-2-.1-3.6-.6-5.3Z"
      />
    </svg>
  );
}

/** Pops once whenever the number goes up. */
function usePop(value: number) {
  const prev = useRef(value);
  const [popKey, setPopKey] = useState(0);
  useEffect(() => {
    if (value > prev.current) setPopKey((k) => k + 1);
    prev.current = value;
  }, [value]);
  return popKey;
}

/** The little flame pill in the header. */
export function StreakBadge() {
  const streak = useStreak();
  const popKey = usePop(streak?.current ?? 0);
  if (!streak) return null;

  const state = flameState(streak);
  const label =
    state === "lit"
      ? `${streak.current}-day streak. You've played today!`
      : state === "waiting"
        ? `${streak.current}-day streak. Answer a quiz question today to keep it going.`
        : "No streak yet. Answer a quiz question to start one.";

  return (
    <Link
      href="/quiz"
      title={label}
      aria-label={label}
      className={`group relative flex shrink-0 items-center gap-1 rounded-full py-1 pl-1.5 pr-2.5 text-sm font-bold tabular-nums ring-1 transition-all hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
        state === "lit"
          ? "bg-linear-to-b from-orange-50 to-orange-100 text-orange-700 ring-orange-300/70 shadow-[0_4px_14px_-6px_rgb(234_88_12/0.6)]"
          : state === "waiting"
            ? "bg-white/80 text-orange-600 ring-orange-200"
            : "bg-white/70 text-stone-400 ring-black/[0.06]"
      }`}
    >
      <span key={popKey} className={`relative ${popKey ? "animate-streak-pop" : ""}`}>
        <Flame
          state={state}
          className={`size-5 ${state === "lit" ? "animate-flicker" : ""} ${
            state === "waiting" ? "group-hover:animate-flicker" : ""
          }`}
        />
      </span>
      <span key={`n${popKey}`} className={popKey ? "animate-streak-pop" : ""}>
        {streak.current}
      </span>
      {state === "waiting" && (
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-orange-500 ring-2 ring-white">
          <span className="absolute inset-0 animate-ping rounded-full bg-orange-400" />
        </span>
      )}
    </Link>
  );
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" });
const dayLetter = (day: string) => WEEKDAY.format(new Date(`${day}T12:00:00Z`));

/** The big streak card with the last seven days. */
export function StreakCard() {
  const streak = useStreak();
  const popKey = usePop(streak?.current ?? 0);
  if (!streak) return null;

  const state = flameState(streak);
  const today = todayInNewYork();
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6));
  const message =
    state === "lit"
      ? streak.current === 1
        ? "Day one! Come back tomorrow to keep it going."
        : "You've played today. See you tomorrow!"
      : state === "waiting"
        ? "Answer a quiz question today to keep your streak alive."
        : streak.best > 0
          ? "Your streak ended. Answer a question to start a new one."
          : "Answer a quiz question to start your first streak.";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 ring-1 ${
        state === "lit"
          ? "bg-linear-to-br from-orange-500 via-orange-500 to-rose-600 text-white ring-orange-600/30 shadow-[0_18px_40px_-18px_rgb(234_88_12/0.8)]"
          : "card"
      }`}
    >
      {state === "lit" && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-yellow-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-rose-400/40 blur-3xl"
          />
        </>
      )}

      <div className="relative flex items-center gap-5">
        <div
          className={`grid size-20 shrink-0 place-items-center rounded-2xl ${
            state === "lit" ? "bg-white/15 ring-1 ring-white/25" : "bg-orange-50 ring-1 ring-orange-100"
          }`}
        >
          <span key={popKey} className={popKey ? "animate-streak-pop" : ""}>
            <Flame
              state={state}
              className={`block size-14 drop-shadow ${state === "lit" ? "animate-flicker" : ""}`}
            />
          </span>
        </div>
        <div className="min-w-0">
          <p
            className={`text-[0.7rem] font-semibold uppercase tracking-[0.18em] ${
              state === "lit" ? "text-orange-100" : "text-stone-500"
            }`}
          >
            Daily streak
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              key={popKey}
              className={`font-serif text-6xl leading-none font-semibold tabular-nums ${
                popKey ? "animate-streak-pop inline-block" : ""
              } ${state === "lit" ? "" : state === "waiting" ? "text-orange-600" : "text-stone-400"}`}
            >
              {streak.current}
            </span>
            <span className={`text-lg font-medium ${state === "lit" ? "text-orange-50" : "text-stone-600"}`}>
              {streak.current === 1 ? "day" : "days"}
            </span>
          </p>
          <p className={`mt-2 text-sm ${state === "lit" ? "text-orange-50" : "text-stone-600"}`}>
            {message}
          </p>
        </div>
      </div>

      <div className="relative mt-6 flex items-end justify-between gap-2">
        <ol className="flex gap-1.5 sm:gap-2" aria-label="The last seven days">
          {week.map((d) => {
            const played = streak.days.has(d);
            const isToday = d === today;
            return (
              <li key={d} className="flex flex-col items-center gap-1.5">
                <span
                  className={`grid size-8 place-items-center rounded-full text-xs font-bold transition sm:size-9 ${
                    played
                      ? state === "lit"
                        ? "bg-white text-orange-600 shadow-sm"
                        : "bg-linear-to-b from-yellow-400 to-orange-500 text-white shadow-sm"
                      : state === "lit"
                        ? "bg-white/15 text-white/70"
                        : "bg-stone-100 text-stone-400"
                  } ${isToday ? (state === "lit" ? "ring-2 ring-white/70 ring-offset-2 ring-offset-orange-500" : "ring-2 ring-orange-300 ring-offset-2") : ""}`}
                  title={`${d}${played ? ": played" : ""}`}
                >
                  {played ? "✓" : ""}
                  <span className="sr-only">
                    {d} {played ? "played" : "not played"}
                  </span>
                </span>
                <span
                  className={`text-[0.65rem] font-semibold ${
                    state === "lit" ? "text-orange-100" : isToday ? "text-orange-600" : "text-stone-400"
                  }`}
                >
                  {isToday ? "Today" : dayLetter(d)}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="text-right">
          <p
            className={`text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${
              state === "lit" ? "text-orange-100" : "text-stone-500"
            }`}
          >
            Best
          </p>
          <p className="font-serif text-2xl font-semibold tabular-nums">{streak.best}</p>
        </div>
      </div>

      {state !== "lit" && (
        <Link href="/quiz" className="btn-primary relative mt-6 w-full py-3">
          {state === "waiting" ? "Keep my streak" : "Start a streak"} &rarr;
        </Link>
      )}
    </div>
  );
}

/** A small flame-and-number chip for leaderboard rows. */
export function StreakChip({ days, className = "" }: { days: number; className?: string }) {
  if (days <= 0) return null;
  const hot = days >= 7;
  return (
    <span
      title={`${days}-day streak`}
      className={`inline-flex items-center gap-0.5 rounded-full py-0.5 pl-1 pr-2 text-xs font-bold tabular-nums ring-1 ${
        hot
          ? "bg-linear-to-b from-orange-400 to-rose-500 text-white ring-orange-500/40 shadow-[0_3px_10px_-4px_rgb(234_88_12/0.7)]"
          : "bg-orange-50 text-orange-700 ring-orange-200"
      } ${className}`}
    >
      <Flame state="lit" className="size-3.5" />
      {days}
      <span className="sr-only"> day streak</span>
    </span>
  );
}
