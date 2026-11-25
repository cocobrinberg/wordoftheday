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
      <p className="text-lg text-stone-600">
        The quiz needs at least two past words. Come back in a day or two!
      </p>
    );

  const answered = picked !== null;
  const gotIt = picked === question.target.id;

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Quiz</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/stats"
            className="text-sm text-stone-600 underline underline-offset-2 hover:text-stone-900"
          >
            Your stats
          </Link>
          <p className="rounded-full bg-white px-3 py-1 text-sm text-stone-600 ring-1 ring-stone-200">
            Score: <span className="font-semibold text-stone-900">{score.right}</span> / {score.total}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-500">
          Which word means&hellip;
        </p>
        <p className="mt-2 text-lg leading-relaxed sm:text-xl">{question.target.definition}</p>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {question.choices.map((c) => {
          let style = "border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-100";
          if (answered) {
            if (c.id === question.target.id) style = "border-emerald-500 bg-emerald-50 text-emerald-900";
            else if (c.id === picked) style = "border-red-400 bg-red-50 text-red-900";
            else style = "border-stone-200 bg-white text-stone-400";
          }
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => answer(c)}
                disabled={answered}
                className={`w-full rounded-xl border-2 px-4 py-3.5 text-left font-serif text-lg transition-colors disabled:cursor-default ${style}`}
              >
                {c.word}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div
          className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          aria-live="polite"
        >
          <p className={`text-lg ${gotIt ? "text-emerald-700" : "text-red-700"}`}>
            {gotIt ? (
              "Correct!"
            ) : (
              <>
                Not quite. The answer is <strong className="font-serif">{question.target.word}</strong>.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={next}
            disabled={saving}
            className="rounded-full bg-stone-900 px-5 py-2.5 font-medium text-stone-50 hover:bg-stone-700 disabled:opacity-60"
          >
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
