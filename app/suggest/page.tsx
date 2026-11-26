"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { formatDay } from "@/lib/supabase";
import { useAccount } from "@/components/Account";

type Scheduled = { day: string; word: string; part_of_speech: string; definition: string };

export default function Suggest() {
  const { token } = useAccount();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<Scheduled | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, word }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setScheduled(data);
      setWord("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <p className="eyebrow text-accent">Suggestions</p>
      <h1 className="page-title mt-2">Suggest a word</h1>
      <p className="mt-3 max-w-xl text-stone-600">
        Know a word everyone should learn? Send it in and it becomes the word of the day on the
        next open day.
      </p>

      {scheduled && (
        <div className="card mt-8 p-6" role="status">
          <p className="eyebrow">Scheduled</p>
          <p className="mt-2 font-serif text-2xl text-ink">
            <span className="font-semibold">{scheduled.word}</span> will be the word of the day on{" "}
            <span className="font-semibold text-accent">{formatDay(scheduled.day)}</span>.
          </p>
          <p className="mt-2 text-sm text-stone-600">
            <span className="italic">{scheduled.part_of_speech}</span> &middot; {scheduled.definition}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
        <label className="block">
          <span className="eyebrow">Your word</span>
          <input
            className="input mt-2"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="e.g. petrichor"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            required
          />
        </label>
        {error && <p className="alert-error">{error}</p>}
        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary" disabled={busy || !word.trim()}>
            {busy ? "Submitting…" : "Submit"}
          </button>
          <Link href="/" className="link text-sm">
            Back to today
          </Link>
        </div>
      </form>
    </div>
  );
}
