import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

export type Word = {
  id: number;
  word: string;
  part_of_speech: string;
  definition: string;
  example: string;
  day: string;
};

export type Attempt = {
  id: number;
  word_id: number;
  correct: boolean;
  created_at: string;
};

export const TIME_ZONE = "America/New_York";

/** Today's date as YYYY-MM-DD in America/New_York. */
export function todayInNewYork(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Format a YYYY-MM-DD date for display without time-zone shifting. */
export function formatDay(day: string, opts?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

/**
 * All words dated strictly before today (New York time), newest first.
 * Filtering here matters: the database's own "today" may already be
 * tomorrow in New York during the evening.
 */
export async function fetchPastWords(): Promise<Word[]> {
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .lt("day", todayInNewYork())
    .order("day", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Shown when the stats functions haven't been added to the database yet. */
function statsError(e: { message: string }): Error {
  if (e.message.includes("Could not find the function")) {
    return new Error("Quiz scores aren't set up in the database yet. Run supabase/stats.sql in Supabase.");
  }
  return new Error(e.message);
}

/** Every quiz answer the signed-in account has given. */
export async function fetchAttempts(token: string): Promise<Attempt[]> {
  const { data, error } = await supabase.rpc("my_attempts", { p_token: token });
  if (error) throw statsError(error);
  return data ?? [];
}

/** Saves one quiz answer for the signed-in account and returns the saved row. */
export async function recordAttempt(token: string, wordId: number, correct: boolean): Promise<Attempt> {
  const { data, error } = await supabase.rpc("record_attempt", {
    p_token: token,
    p_word_id: wordId,
    p_correct: correct,
  });
  if (error) throw statsError(error);
  return (data as Attempt[])[0];
}

export type LeaderboardRow = { username: string; right_count: number; total: number; percent: number };

/** Everyone's quiz totals, best percentage first. */
export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc("leaderboard");
  if (error) throw statsError(error);
  return ((data ?? []) as LeaderboardRow[]).map((r) => ({
    username: r.username,
    right_count: Number(r.right_count),
    total: Number(r.total),
    percent: Number(r.percent),
  }));
}
