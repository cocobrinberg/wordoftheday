"use client";

import { useSyncExternalStore } from "react";
import { fetchAttempts, supabase, TIME_ZONE, todayInNewYork } from "@/lib/supabase";

/**
 * A streak is the number of days in a row (New York time) on which someone
 * answered at least one quiz question. It stays alive through today if they
 * played yesterday, so it only breaks once a whole day goes by without playing.
 */
export type Streak = {
  /** Days in a row, ending today or yesterday. */
  current: number;
  /** Longest run ever. */
  best: number;
  /** True once a question has been answered today. */
  playedToday: boolean;
  /** Every YYYY-MM-DD day with at least one answer. */
  days: Set<string>;
};

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The New York day (YYYY-MM-DD) a timestamp falls on. */
export function nyDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

/** Moves a YYYY-MM-DD day by a number of days. */
export function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
}

export function computeStreak(days: Iterable<string>, today = todayInNewYork()): Streak {
  const set = new Set(days);
  const sorted = [...set].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const playedToday = set.has(today);
  let current = 0;
  for (let d = playedToday ? today : shiftDay(today, -1); set.has(d); d = shiftDay(d, -1)) current++;
  return { current, best, playedToday, days: set };
}

// A tiny shared store so the header, the quiz and the stats page all show the
// same streak, and it ticks up the moment a question is answered.

let state: Streak | null = null;
const listeners = new Set<() => void>();

function set(next: Streak | null) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The signed-in player's streak, or null while it loads or when signed out. */
export function useStreak(): Streak | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
}

export async function loadStreak(token: string) {
  const attempts = await fetchAttempts(token);
  set(computeStreak(attempts.map((a) => nyDay(a.created_at))));
}

export function clearStreak() {
  set(null);
}

/** Call after an answer is saved so the streak updates without a reload. */
export function noteAnswerToday() {
  const days = new Set(state?.days ?? []);
  days.add(todayInNewYork());
  set(computeStreak(days));
}

export type StreakRow = { username: string; current_streak: number; best_streak: number };

/** Everyone's streaks, or null until supabase/streaks.sql has been run. */
export async function fetchStreaks(): Promise<StreakRow[] | null> {
  const { data, error } = await supabase.rpc("streaks");
  if (error) {
    if (error.code === "PGRST202" || error.message.includes("Could not find the function")) return null;
    throw new Error(error.message);
  }
  return ((data ?? []) as StreakRow[]).map((r) => ({
    username: r.username,
    current_streak: Number(r.current_streak),
    best_streak: Number(r.best_streak),
  }));
}
