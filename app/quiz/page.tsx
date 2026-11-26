"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAttempts, fetchPastWords, recordAttempt, type Attempt, type Word } from "@/lib/supabase";
import { Loading, ErrorMessage } from "@/components/Status";
import { useAccount } from "@/components/Account";

type Question = { target: Word; choices: Word[] };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Words missed more often get a higher weight, so they come up more.
 * weight = (1 + 3 * misses) / (1 + rights): an unseen word is 1,
 * each miss raises it a lot, each correct answer pulls it back down.
 */
function weightFor(word: Word, attempts: Attempt[]): number {
  let misses = 0;
  let rights = 0;
  for (const a of attempts) {
    if (a.word_id !== word.id) continue;
    if (a.correct) rights++;
    else misses++;
  }
  return (1 + 3 * misses) / (1 + rights);
}

function pickQuestion(words: Word[], attempts: Attempt[], previousId?: number): Question {
  // Avoid asking the same word twice in a row when there is a choice.
  const pool = words.length > 1 ? words.filter((w) => w.id !== previousId) : words;
  const weights = pool.map((w) => weightFor(w, attempts));
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  let target = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      target = pool[i];
      break;
    }
  }
  const distractors = shuffle(words.filter((w) => w.id !== target.id)).slice(0, 3);
  return { target, choices: shuffle([target, ...distractors]) };
}

export default function Quiz() {
  const { token } = useAccount();
  const [words, setWords] = useState<Word[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchPastWords(), fetchAttempts(token)])
      .then(([w, a]) => {
        setWords(w);
        setAttempts(a);
        if (w.length >= 2) setQuestion(pickQuestion(w, a));
      })
      .catch((e) => setError(e.message ?? String(e)));
  }, [token]);

  async function answer(choice: Word) {
    if (!question || picked !== null) return;
    const correct = choice.id === question.target.id;
    setPicked(choice.id);
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
    setSaving(true);
    try {
      const saved = await recordAttempt(token, question.target.id, correct);
      setAttempts((a) => [...a, saved]);
    } catch (e) {
      setError(`Could not save your answer: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (!words || !question) return;
    setPicked(null);
    setError(null);
    setQuestion(pickQuestion(words, attempts, question.target.id));
  }

  if (error && !words) return <ErrorMessage message={error} />;
  if (!words) return <Loading />;
  if (!question)
    return (
      <div className="card p-8 text-center">
        <p className="font-serif text-2xl font-semibold">Not enough words yet</p>
        <p className="mt-2 text-stone-600">
          The quiz needs at least two past words. Come back in a day or two!
        </p>
      </div>
    );

  const answered = picked !== null;
  const gotIt = picked === question.target.id;

  return (
    <section className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent">Practice</p>
          <h1 className="page-title mt-2">Quiz</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/stats" className="link text-sm">
            Your stats
          </Link>
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
            "bg-white/85 ring-black/[0.08] hover:-translate-y-0.5 hover:ring-ink hover:shadow-md";
          let badge = "bg-stone-100 text-stone-500 group-hover:bg-ink group-hover:text-stone-50";
          if (answered) {
            if (c.id === question.target.id) {
              style = "bg-emerald-50 ring-2 ring-emerald-500 text-emerald-950";
              badge = "bg-emerald-500 text-white";
            } else if (c.id === picked) {
              style = "bg-rose-50 ring-2 ring-rose-400 text-rose-950";
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
                className={`group flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left ring-1 shadow-sm transition disabled:cursor-default ${style}`}
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
          <button type="button" onClick={next} disabled={saving} className="btn-primary shrink-0">
            Next question &rarr;
          </button>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      )}
    </section>
  );
}
