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

export async function fetchAttempts(): Promise<Attempt[]> {
  const { data, error } = await supabase.from("quiz_attempts").select("*");
  if (error) throw error;
  return data ?? [];
}
