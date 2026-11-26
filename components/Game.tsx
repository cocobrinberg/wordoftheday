"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { clearXp, levelFor, loadXp, useXp } from "@/lib/xp";
import { useStreak } from "@/lib/streak";

/** Loads the signed-in player's XP into the shared store. */
export function XpSync({ token, username }: { token: string; username: string }) {
  useEffect(() => {
    loadXp(token, username).catch(() => {});
    return clearXp;
  }, [token, username]);
  return null;
}

export function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <defs>
        <linearGradient id="star-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-amber-200)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-amber-500)" }} />
        </linearGradient>
      </defs>
      <path
        fill="url(#star-g)"
        style={{ stroke: "var(--color-amber-600)" }}
        strokeWidth="1"
        strokeLinejoin="round"
        d="m12 2.6 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.6Z"
      />
    </svg>
  );
}

/** Pops once whenever the number goes up. */
function useBump(value: number) {
  const prev = useRef(value);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (value > prev.current) setKey((k) => k + 1);
    prev.current = value;
  }, [value]);
  return key;
}

/** Level pill with a progress ring, for the header. */
export function LevelBadge({ className = "" }: { className?: string }) {
  const xp = useXp();
  const bump = useBump(xp?.xp ?? 0);
  if (!xp) return null;
  const lv = levelFor(xp.xp);
  const pct = lv.into / lv.needed;
  const r = 9;
  const c = 2 * Math.PI * r;
  const label = `Level ${lv.level}: ${lv.into} of ${lv.needed} XP to level ${lv.level + 1}`;
  return (
    <Link
      href="/stats"
      title={label}
      aria-label={label}
      className={`shrink-0 items-center gap-1.5 rounded-full bg-white/80 py-1 pl-1 pr-2.5 text-sm font-bold text-yellow-800 ring-1 ring-yellow-200 transition hover:-translate-y-px ${className}`}
    >
      <span className="relative grid size-6 place-items-center">
        <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="12" cy="12" r={r} fill="none" strokeWidth="3" className="stroke-yellow-100" />
          <circle
            cx="12"
            cy="12"
            r={r}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className="stroke-yellow-500 transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <StarIcon className="relative size-3.5" />
      </span>
      <span key={bump} className={`tabular-nums ${bump ? "animate-streak-pop" : ""}`}>
        Lv {lv.level}
      </span>
    </Link>
  );
}

/** Big level card with an XP bar. */
export function LevelCard() {
  const xp = useXp();
  if (!xp) return null;
  const lv = levelFor(xp.xp);
  const pct = Math.round((100 * lv.into) / lv.needed);
  return (
    <div className="card relative overflow-hidden p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-yellow-200/50 blur-3xl"
      />
      <div className="relative flex items-center gap-5">
        <div className="relative grid size-20 shrink-0 place-items-center">
          <StarIcon className="absolute inset-0 size-20 drop-shadow-md" />
          <span className="relative mt-1 font-serif text-2xl font-bold text-yellow-950">{lv.level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Level {lv.level}</p>
          <p className="mt-1 font-serif text-3xl font-semibold">{titleFor(lv.level)}</p>
          <div
            className="mt-3 h-3.5 overflow-hidden rounded-full bg-stone-100 ring-1 ring-black/5"
            role="progressbar"
            aria-valuenow={lv.into}
            aria-valuemax={lv.needed}
            aria-label={`XP toward level ${lv.level + 1}`}
          >
            <div
              className="xp-shine h-full rounded-full bg-linear-to-r from-yellow-400 to-orange-500 transition-[width] duration-700"
              style={{ width: `${Math.max(pct, 3)}%` }}
            />
          </div>
          <p className="mt-1.5 flex justify-between text-xs font-semibold text-stone-500 tabular-nums">
            <span>
              {lv.into} / {lv.needed} XP
            </span>
            <span>{lv.total} XP total</span>
          </p>
        </div>
      </div>
    </div>
  );
}

const TITLES = ["Word Sprout", "Page Turner", "Word Collector", "Wordsmith", "Lexicon Hero", "Word Wizard", "Grand Lexicographer"];
export function titleFor(level: number) {
  return TITLES[Math.min(Math.floor((level - 1) / 2), TITLES.length - 1)];
}

/** Today's three goals on the Today page. */
export function DailyGoals() {
  const xp = useXp();
  const streak = useStreak();
  if (!xp) return null;
  const goals = [
    { icon: "🔊", label: "Hear today's word", hint: "Tap the speaker", done: xp.daily.heard, progress: xp.daily.heard ? 1 : 0 },
    {
      icon: "⚡",
      label: "Answer a question",
      hint: "Keeps your streak alive",
      done: xp.daily.answered > 0 || !!streak?.playedToday,
      progress: xp.daily.answered > 0 || streak?.playedToday ? 1 : 0,
    },
    {
      icon: "🎯",
      label: "Get 5 right",
      hint: `${Math.min(xp.daily.right, 5)} of 5`,
      done: xp.daily.right >= 5,
      progress: Math.min(xp.daily.right, 5) / 5,
    },
  ];
  const doneCount = goals.filter((g) => g.done).length;
  const allDone = doneCount === goals.length;

  return (
    <section className="card mt-8 p-6" aria-labelledby="goals">
      <div className="flex items-center justify-between gap-3">
        <h2 id="goals" className="font-serif text-2xl font-semibold">
          Today&rsquo;s goals
        </h2>
        <span
          className={`chip tabular-nums ${
            allDone ? "animate-pop bg-emerald-500 text-white" : "bg-orange-100 text-orange-700"
          }`}
        >
          {allDone ? "All done! 🎉" : `${doneCount} / ${goals.length} done`}
        </span>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {goals.map((g) => (
          <li
            key={g.label}
            className={`rounded-2xl p-4 ring-2 transition ${
              g.done
                ? "bg-emerald-50 ring-emerald-300 shadow-[0_4px_0_0_var(--color-emerald-300)]"
                : "bg-stone-50 ring-stone-200 shadow-[0_4px_0_0_var(--color-stone-200)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`grid size-11 shrink-0 place-items-center rounded-xl text-xl ${
                  g.done ? "animate-pop bg-emerald-500 text-white" : "bg-white ring-2 ring-stone-200"
                }`}
              >
                {g.done ? "✓" : g.icon}
              </span>
              <span className="min-w-0">
                <span className={`block font-extrabold leading-tight ${g.done ? "text-emerald-800" : "text-ink"}`}>
                  {g.label}
                  <span className="sr-only">{g.done ? " (done)" : " (not done)"}</span>
                </span>
                <span className="block text-xs font-bold text-stone-500">{g.hint}</span>
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-200/80" aria-hidden>
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${g.done ? "bg-emerald-500" : "bg-orange-400"}`}
                style={{ width: `${Math.max(g.progress * 100, g.progress ? 8 : 0)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {!allDone && (
        <Link href="/quiz" className="btn-primary mt-6 w-full py-3.5 text-base sm:w-auto sm:px-8">
          ▶ Play the quiz
        </Link>
      )}
    </section>
  );
}

type Badge = { name: string; icon: string; how: string; earned: boolean };

/** Milestone badges for the Stats page. */
export function Badges() {
  const xp = useXp();
  const streak = useStreak();
  if (!xp) return null;
  const level = levelFor(xp.xp).level;
  const best = streak?.best ?? 0;
  const badges: Badge[] = [
    { name: "First answer", icon: "🌱", how: "Answer a quiz question", earned: xp.answered >= 1 },
    { name: "Sharp mind", icon: "🎯", how: "Get 10 right", earned: xp.right >= 10 },
    { name: "Word hoard", icon: "📚", how: "Get 50 right", earned: xp.right >= 50 },
    { name: "Warming up", icon: "🔥", how: "3-day streak", earned: best >= 3 },
    { name: "Week warrior", icon: "🗓️", how: "7-day streak", earned: best >= 7 },
    { name: "Level 5", icon: "⭐", how: "Reach level 5", earned: level >= 5 },
  ];
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section aria-labelledby="badges">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="badges" className="eyebrow">
          Badges
        </h2>
        <span className="text-xs font-semibold text-stone-500 tabular-nums">
          {earned} of {badges.length} earned
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map((b) => (
          <li
            key={b.name}
            className={`flex items-center gap-3 rounded-2xl p-3.5 ring-1 transition ${
              b.earned
                ? "bg-linear-to-br from-yellow-50 to-white ring-yellow-300 shadow-[0_6px_16px_-10px_rgb(from_var(--color-amber-600)_r_g_b/0.6)]"
                : "bg-white/50 ring-black/[0.06]"
            }`}
          >
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-xl text-2xl ${
                b.earned ? "bg-yellow-100" : "bg-stone-100 grayscale opacity-40"
              }`}
              aria-hidden
            >
              {b.earned ? b.icon : "🔒"}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${b.earned ? "text-ink" : "text-stone-500"}`}>
                {b.name}
                <span className="sr-only">{b.earned ? " (earned)" : " (locked)"}</span>
              </span>
              <span className="block text-xs text-stone-500">{b.how}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const CONFETTI_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#f97316"];

/** A one-shot confetti burst; remount with a new key to fire again. */
export function Confetti({ count = 18 }: { count?: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 2 * Math.PI + (i % 3) * 0.2;
        const dist = 70 + (i % 4) * 22;
        const style = {
          "--dx": `${Math.cos(angle) * dist}px`,
          "--dy": `${Math.sin(angle) * dist - 30}px`,
          "--rot": `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animationDelay: `${(i % 5) * 15}ms`,
        } as CSSProperties;
        return (
          <span
            key={i}
            className={`confetti absolute top-1/2 left-1/2 ${i % 3 ? "h-2 w-1.5" : "size-2 rounded-full"}`}
            style={style}
          />
        );
      })}
    </span>
  );
}
