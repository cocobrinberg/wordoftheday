"use client";

import { useEffect, useRef, useState } from "react";
import type { Word } from "@/lib/supabase";
import { ISEE_WORDS } from "@/lib/iseeWords";
import { Loading } from "@/components/Status";
import { useAccount } from "@/components/Account";

type Question = { target: Word; choices: Word[] };

/** Saved per account in this browser: words already asked, and miss counts. */
type Progress = { seen: number[]; missed: Record<number, number> };

/** Roughly how often a question reviews a missed word instead of a new one. */
const REVIEW_SHARE = 0.3;

const progressKey = (username: string) => `wotd-isee-progress:${username}`;

function loadProgress(username: string): Progress {
  try {
    const raw = localStorage.getItem(progressKey(username));
    if (raw) return JSON.parse(raw) as Progress;
  } catch {}
  return { seen: [], missed: {} };
}

function saveProgress(username: string, p: Progress) {
  try {
    localStorage.setItem(progressKey(username), JSON.stringify(p));
  } catch {}
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Most questions ask a word that hasn't come up yet; the rest review words
 * that were missed, favoring the ones missed most. Once every word has been
 * asked, the list starts over.
 */
function pickQuestion(p: Progress, previousId?: number): Question {
  const seen = new Set(p.seen);
  let fresh = ISEE_WORDS.filter((w) => !seen.has(w.id));
  if (!fresh.length) {
    p.seen = [];
    fresh = ISEE_WORDS.filter((w) => w.id !== previousId);
  }
  const review = ISEE_WORDS.filter((w) => p.missed[w.id] && w.id !== previousId);
  let target = fresh[Math.floor(Math.random() * fresh.length)];
  if (review.length && Math.random() < REVIEW_SHARE) {
    const weights = review.map((w) => p.missed[w.id]);
    let r = Math.random() * weights.reduce((s, x) => s + x, 0);
    target = review[review.length - 1];
    for (let i = 0; i < review.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        target = review[i];
        break;
      }
    }
  }
  if (!p.seen.includes(target.id)) p.seen.push(target.id);
  const distractors = shuffle(ISEE_WORDS.filter((w) => w.id !== target.id)).slice(0, 3);
  return { target, choices: shuffle([target, ...distractors]) };
}

export default function IseePrep() {
  const { account } = useAccount();
  const progress = useRef<Progress>({ seen: [], missed: {} });
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [counts, setCounts] = useState({ seen: 0, missed: 0 });

  function save() {
    const p = progress.current;
    setCounts({ seen: p.seen.length, missed: Object.keys(p.missed).length });
    saveProgress(account.username, p);
  }

  useEffect(() => {
    // Progress lives in localStorage, so it is read after the first render.
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const p = loadProgress(account.username);
      progress.current = p;
      setQuestion(pickQuestion(p));
      setCounts({ seen: p.seen.length, missed: Object.keys(p.missed).length });
      saveProgress(account.username, p);
    });
    return () => {
      cancelled = true;
    };
  }, [account.username]);

  function answer(choice: Word) {
    if (!question || picked !== null) return;
    const id = question.target.id;
    const correct = choice.id === id;
    setPicked(choice.id);
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
    // A miss adds weight; a right answer takes one away until the word leaves the review list.
    const missed = progress.current.missed;
    if (!correct) missed[id] = (missed[id] ?? 0) + 1;
    else if (missed[id]) {
      missed[id] -= 1;
      if (!missed[id]) delete missed[id];
    }
    save();
  }

  function next() {
    if (!question) return;
    setPicked(null);
    setQuestion(pickQuestion(progress.current, question.target.id));
    save();
  }

  if (!question) return <Loading />;

  const answered = picked !== null;
  const gotIt = picked === question.target.id;

  return (
    <section className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent">Test practice</p>
          <h1 className="page-title mt-2">ISEE Prep</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-stone-500 tabular-nums">
            {counts.seen} of {ISEE_WORDS.length} seen
            {counts.missed > 0 && <> &middot; {counts.missed} to review</>}
          </p>
          <p className="card flex items-baseline gap-1.5 rounded-full px-4 py-1.5 text-sm text-stone-500">
            Score
            <span className="font-serif text-lg font-semibold text-ink tabular-nums">{score.right}</span>
            <span className="tabular-nums">/ {score.total}</span>
          </p>
        </div>
      </div>

      <div key={question.target.id} className="card animate-rise mt-8 px-6 py-7 sm:px-8 sm:py-9">
        <p className="eyebrow">Which word means&hellip;</p>
        <p className="mt-3 font-serif text-2xl leading-snug text-ink sm:text-3xl">
          {question.target.definition}
        </p>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {question.choices.map((c, i) => {
          let style =
            "bg-white ring-stone-200 shadow-[0_5px_0_0_var(--color-stone-200)] hover:-translate-y-0.5 hover:bg-orange-50 hover:ring-orange-300 hover:shadow-[0_6px_0_0_var(--color-orange-300)] active:translate-y-1 active:shadow-none";
          let badge = "bg-stone-100 text-stone-500 group-hover:bg-orange-500 group-hover:text-white";
          if (answered) {
            if (c.id === question.target.id) {
              style = "animate-pop bg-emerald-50 ring-emerald-500 text-emerald-950 shadow-[0_5px_0_0_var(--color-emerald-500)]";
              badge = "bg-emerald-500 text-white";
            } else if (c.id === picked) {
              style = "animate-shake bg-rose-50 ring-rose-400 text-rose-950 shadow-[0_5px_0_0_var(--color-rose-400)]";
              badge = "bg-rose-400 text-white";
            } else {
              style = "bg-white/60 ring-black/[0.06] text-stone-400";
              badge = "bg-stone-100 text-stone-400";
            }
          }
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => answer(c)}
                disabled={answered}
                className={`group flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left ring-2 shadow-sm transition disabled:cursor-default ${style}`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold transition-colors ${badge}`}
                >
                  {answered && c.id === question.target.id
                    ? "✓"
                    : answered && c.id === picked
                      ? "✕"
                      : "ABCD"[i]}
                </span>
                <span className="font-serif text-xl font-medium">{c.word}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div
          className={`animate-rise mt-6 flex flex-col gap-4 rounded-2xl p-5 ring-1 sm:flex-row sm:items-center sm:justify-between ${
            gotIt ? "bg-emerald-50 ring-emerald-200" : "bg-rose-50 ring-rose-200"
          }`}
          aria-live="polite"
        >
          <p className={`text-lg ${gotIt ? "text-emerald-900" : "text-rose-900"}`}>
            {gotIt ? (
              <>
                <strong className="font-semibold">Correct!</strong> Nicely done.
              </>
            ) : (
              <>
                Not quite. The answer is{" "}
                <strong className="font-serif font-semibold">{question.target.word}</strong>.
              </>
            )}
          </p>
          <button type="button" onClick={next} className="btn-primary shrink-0">
            Next question &rarr;
          </button>
        </div>
      )}
    </section>
  );
}
