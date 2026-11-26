"use client";

import { useSyncExternalStore } from "react";
import { fetchAttempts, todayInNewYork, type Attempt } from "@/lib/supabase";

/**
 * Points (XP) and levels.
 *
 * Saved quiz answers (words of the day) are the base: 10 XP for a right
 * answer, 2 for trying. Answers that aren't saved to the database (word-bank
 * questions) and combo bonuses are kept per account in this browser, so XP is
 * the saved total plus that local bonus. Nothing here needs a database change.
 */

export const XP_RIGHT = 10;
export const XP_WRONG = 2;
/** Extra XP per right answer once a combo reaches this many in a row. */
export const COMBO_AT = 3;
export const COMBO_BONUS = 5;

/** XP needed to go from `level` to `level + 1`: 100, 150, 200, … */
const stepFor = (level: number) => 50 + 50 * level;

export type Level = { level: number; into: number; needed: number; total: number };

export function levelFor(xp: number): Level {
  let level = 1;
  let rest = xp;
  while (rest >= stepFor(level)) {
    rest -= stepFor(level);
    level++;
  }
  return { level, into: rest, needed: stepFor(level), total: xp };
}

export type Daily = { heard: boolean; answered: number; right: number };

export type XpState = {
  xp: number;
  /** Saved answers, for badges. */
  answered: number;
  right: number;
  /** Today's goals progress. */
  daily: Daily;
};

const EMPTY_DAILY: Daily = { heard: false, answered: 0, right: 0 };

let user: string | null = null;
let base = { xp: 0, answered: 0, right: 0 };
let state: XpState | null = null;
const listeners = new Set<() => void>();

const bonusKey = (u: string) => `wotd-xp-bonus:${u}`;
const dailyKey = (u: string) => `wotd-daily:${u}:${todayInNewYork()}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function publish() {
  if (!user) {
    state = null;
  } else {
    const bonus = read<number>(bonusKey(user), 0);
    state = { ...base, xp: base.xp + bonus, daily: read(dailyKey(user), EMPTY_DAILY) };
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The signed-in player's XP, or null while it loads or when signed out. */
export function useXp(): XpState | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
}

function tally(attempts: Attempt[]) {
  const right = attempts.filter((a) => a.correct).length;
  return {
    answered: attempts.length,
    right,
    xp: right * XP_RIGHT + (attempts.length - right) * XP_WRONG,
  };
}

export async function loadXp(token: string, username: string) {
  const attempts = await fetchAttempts(token);
  user = username;
  base = tally(attempts);
  publish();
}

export function clearXp() {
  user = null;
  base = { xp: 0, answered: 0, right: 0 };
  publish();
}

/**
 * Records one quiz answer and returns the XP it earned.
 * `saved` is true when the answer was stored in the database.
 */
export function awardAnswer(correct: boolean, combo: number, saved: boolean): number {
  if (!user) return 0;
  const points = correct ? XP_RIGHT : XP_WRONG;
  const bonus = correct && combo >= COMBO_AT ? COMBO_BONUS : 0;
  if (saved) {
    base = {
      xp: base.xp + points,
      answered: base.answered + 1,
      right: base.right + (correct ? 1 : 0),
    };
  }
  const local = (saved ? 0 : points) + bonus;
  if (local) write(bonusKey(user), read<number>(bonusKey(user), 0) + local);
  const d = read(dailyKey(user), EMPTY_DAILY);
  write(dailyKey(user), { ...d, answered: d.answered + 1, right: d.right + (correct ? 1 : 0) });
  publish();
  return points + bonus;
}

/** Adds a flat XP prize (like winning a battle) to the signed-in player's local bonus. */
export function awardBonus(points: number) {
  if (!user || points <= 0) return;
  write(bonusKey(user), read<number>(bonusKey(user), 0) + points);
  publish();
}

/** Marks today's "hear the word" goal as done. */
export function noteHeard() {
  if (!user) return;
  const d = read(dailyKey(user), EMPTY_DAILY);
  if (d.heard) return;
  write(dailyKey(user), { ...d, heard: true });
  publish();
}
