"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  fetchAttempts,
  fetchWordsThroughToday,
  recordAttempt,
  recordBankAttempt,
  type Attempt,
  type Word,
} from "@/lib/supabase";
import { WORD_BANK } from "@/lib/wordBank";
import { Loading, ErrorMessage } from "@/components/Status";
import { useAccount } from "@/components/Account";
import { noteAnswerToday } from "@/lib/streak";
import { awardAnswer, COMBO_AT } from "@/lib/xp";
import { Confetti, LevelBadge } from "@/components/Game";
import { Flame } from "@/components/Streak";
import LanguagePicker, { useLanguage } from "@/components/LanguagePicker";
import { AnswerName, WordLabel, useWordTranslations } from "@/components/TranslatedWord";

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

/** Roughly how often a question reviews a word of the day instead of a new bank word. */
const DAY_WORD_SHARE = 0.3;

const seenKey = (username: string) => `wotd-quiz-seen:${username}`;

/** Bank words this account has already been asked, so they aren't asked again. */
function loadSeen(username: string): Set<number> {
  try {
    const raw = localStorage.getItem(seenKey(username));
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(username: string, seen: Set<number>) {
  try {
    localStorage.setItem(seenKey(username), JSON.stringify([...seen]));
  } catch {}
}

/** Picks a word of the day, favoring ones missed more often. */
function pickDayWord(dayWords: Word[], attempts: Attempt[], previousId?: number): Word {
  // Avoid asking the same word twice in a row when there is a choice.
  const pool = dayWords.length > 1 ? dayWords.filter((w) => w.id !== previousId) : dayWords;
  const weights = pool.map((w) => weightFor(w, attempts));
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Most questions use a bank word that hasn't been asked before; the rest
 * review words of the day, which are the only ones that come back. Once
 * every bank word has been asked, the bank starts over.
 */
function pickQuestion(
  dayWords: Word[],
  bank: Word[],
  attempts: Attempt[],
  seen: Set<number>,
  previousId?: number,
): Question {
  let fresh = bank.filter((w) => !seen.has(w.id));
  if (!fresh.length) {
    seen.clear();
    fresh = bank.filter((w) => w.id !== previousId);
  }
  const useDayWord = dayWords.length > 0 && (!fresh.length || Math.random() < DAY_WORD_SHARE);
  const target = useDayWord
    ? pickDayWord(dayWords, attempts, previousId)
    : fresh[Math.floor(Math.random() * fresh.length)];
  if (target.id < 0) seen.add(target.id);

  const all = [...dayWords, ...bank];
  const distractors = shuffle(all.filter((w) => w.id !== target.id)).slice(0, 3);
  return { target, choices: shuffle([target, ...distractors]) };
}

/** Questions per round. */
const ROUND = 10;

type Round = { results: boolean[]; xp: number; bestCombo: number };
const NEW_ROUND: Round = { results: [], xp: 0, bestCombo: 0 };

export default function Quiz() {
  const { token, account } = useAccount();
  const [words, setWords] = useState<Word[] | null>(null);
  const [bank, setBank] = useState<Word[]>([]);
  const seen = useRef<Set<number>>(new Set());
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [round, setRound] = useState<Round>(NEW_ROUND);
  const [summary, setSummary] = useState(false);
  const [gain, setGain] = useState<{ points: number; key: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useLanguage();
  const translations = useWordTranslations(question?.choices ?? [], lang);

  useEffect(() => {
    Promise.all([fetchWordsThroughToday(), fetchAttempts(token)])
      .then(([w, a]) => {
        // A bank word that is also a word of the day is asked as the word of the day.
        const dayNames = new Set(w.map((d) => d.word.toLowerCase()));
        const b = WORD_BANK.filter((x) => !dayNames.has(x.word.toLowerCase()));
        seen.current = loadSeen(account.username);
        setWords(w);
        setBank(b);
        setAttempts(a);
        if (w.length + b.length >= 4) {
          setQuestion(pickQuestion(w, b, a, seen.current));
          saveSeen(account.username, seen.current);
        }
      })
      .catch((e) => setError(e.message ?? String(e)));
  }, [token, account.username]);

  async function answer(choice: Word) {
    if (!question || picked !== null || translations.loading) return;
    const correct = choice.id === question.target.id;
    const nextCombo = correct ? combo + 1 : 0;
    setPicked(choice.id);
    setCombo(nextCombo);

    const award = (saved: boolean) => {
      const points = awardAnswer(correct, nextCombo, saved);
      setGain({ points, key: Date.now() });
      setRound((r) => ({
        results: [...r.results, correct],
        xp: r.xp + points,
        bestCombo: Math.max(r.bestCombo, nextCombo),
      }));
    };

    // Every answer is saved so it counts on the leaderboard. Practice-bank
    // words have no database row, so they're saved by name.
    const isBank = question.target.id < 0;
    setSaving(true);
    try {
      const saved = isBank
        ? await recordBankAttempt(token, question.target.word, correct)
        : await recordAttempt(token, question.target.id, correct);
      if (!saved) return award(false); // the database isn't set up for bank words yet
      setAttempts((a) => [...a, saved]);
      noteAnswerToday();
      award(true);
    } catch (e) {
      award(false);
      setError(`Could not save your answer: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (!words || !question) return;
    if (round.results.length >= ROUND && !summary) return setSummary(true);
    setPicked(null);
    setError(null);
    setGain(null);
    setQuestion(pickQuestion(words, bank, attempts, seen.current, question.target.id));
    saveSeen(account.username, seen.current);
  }

  function newRound() {
    setRound(NEW_ROUND);
    setSummary(false);
    setPicked(null);
    setError(null);
    setGain(null);
    if (words && question) {
      setQuestion(pickQuestion(words, bank, attempts, seen.current, question.target.id));
      saveSeen(account.username, seen.current);
    }
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

  if (summary) return <RoundSummary round={round} onAgain={newRound} />;

  const answered = picked !== null;
  const gotIt = picked === question.target.id;
  const lastOfRound = answered && round.results.length >= ROUND;
  const questionNumber = Math.min(round.results.length + (answered ? 0 : 1), ROUND);

  return (
    <section className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent">Practice</p>
          <h1 className="page-title mt-2">Quiz</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/stats" className="link mr-1 text-sm">
            Your stats
          </Link>
          <LevelBadge className="flex md:hidden" />
          <LanguagePicker value={lang} onChange={setLang} />
        </div>
      </div>

      {translations.error && (
        <p className="mt-6 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Couldn&rsquo;t translate into {lang.name} right now ({translations.error}). Showing English.
        </p>
      )}

      {/* Round progress: one segment per question. */}
      <div className="mt-8 flex items-center gap-3">
        <ol className="flex flex-1 gap-1.5" aria-label={`Question ${questionNumber} of ${ROUND}`}>
          {Array.from({ length: ROUND }, (_, i) => {
            const r = round.results[i];
            const current = i === round.results.length && !answered;
            return (
              <li
                key={i}
                className={`h-2.5 flex-1 rounded-full transition-colors duration-300 ${
                  r === true
                    ? "bg-emerald-500"
                    : r === false
                      ? "bg-rose-400"
                      : current
                        ? "animate-pulse bg-stone-400"
                        : "bg-stone-200"
                }`}
              />
            );
          })}
        </ol>
        <span className="shrink-0 text-sm font-bold text-stone-500 tabular-nums">
          {round.results.length}/{ROUND}
        </span>
      </div>

      <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
        <span
          key={combo}
          className={`inline-flex items-center gap-1 rounded-full py-1 pr-3 pl-1.5 text-sm font-bold ${
            combo >= COMBO_AT
              ? "animate-pop bg-linear-to-r from-orange-500 to-orange-700 text-white shadow-[0_6px_16px_-8px_rgb(from_var(--color-orange-600)_r_g_b/0.8)]"
              : combo > 0
                ? "animate-pop bg-orange-50 text-orange-700 ring-1 ring-orange-200"
                : "invisible"
          }`}
        >
          <Flame className="size-4" />
          {combo} in a row{combo >= COMBO_AT ? " · +5 bonus" : ""}
        </span>
        <span className="text-sm font-semibold text-stone-500 tabular-nums">
          +{round.xp} XP this round
        </span>
      </div>

      <div key={question.target.id} className="card animate-rise mt-3 px-6 py-7 sm:px-8 sm:py-9">
        <p className="eyebrow">Which word means&hellip;</p>
        <p className="mt-3 font-serif text-2xl leading-snug text-ink sm:text-3xl">
          {question.target.definition}
        </p>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {question.choices.map((c, i) => {
          const isAnswer = c.id === question.target.id;
          const isPick = c.id === picked;
          let style =
            "bg-white ring-stone-200 shadow-[0_5px_0_0_var(--color-stone-200)] hover:-translate-y-0.5 hover:bg-orange-50 hover:ring-orange-300 hover:shadow-[0_6px_0_0_var(--color-orange-300)] active:translate-y-1 active:shadow-none";
          let badge = "bg-stone-100 text-stone-500 group-hover:bg-orange-500 group-hover:text-white";
          if (answered) {
            if (isAnswer) {
              style = `bg-emerald-50 ring-2 ring-emerald-500 text-emerald-950 shadow-[0_4px_0_0_var(--color-emerald-500)] ${
                isPick ? "animate-pop" : ""
              }`;
              badge = "bg-emerald-500 text-white";
            } else if (isPick) {
              style =
                "animate-shake bg-rose-50 ring-2 ring-rose-400 text-rose-950 shadow-[0_4px_0_0_var(--color-rose-400)]";
              badge = "bg-rose-400 text-white";
            } else {
              style = "bg-white/60 ring-black/[0.06] text-stone-400";
              badge = "bg-stone-100 text-stone-400";
            }
          }
          return (
            <li key={c.id} className="relative">
              <button
                type="button"
                onClick={() => answer(c)}
                disabled={answered || translations.loading}
                className={`group flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left ring-2 transition disabled:cursor-default ${style}`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold transition-colors ${badge}`}
                >
                  {answered && isAnswer ? "✓" : answered && isPick ? "✕" : "ABCD"[i]}
                </span>
                {translations.loading ? (
                  <span className="h-6 w-28 animate-pulse rounded-md bg-stone-200" aria-label="Translating…" />
                ) : (
                  <WordLabel word={c} translation={translations.get(c)} lang={lang} revealEnglish={answered} />
                )}
              </button>
              {isPick && gain && (
                <>
                  {gotIt && <Confetti key={`c${gain.key}`} />}
                  <span
                    key={gain.key}
                    className={`animate-float-up pointer-events-none absolute top-0 left-1/2 rounded-full px-2.5 py-0.5 text-sm font-extrabold shadow-sm ${
                      gotIt ? "bg-yellow-400 text-yellow-950" : "bg-stone-200 text-stone-700"
                    }`}
                    aria-hidden
                  >
                    +{gain.points} XP
                  </span>
                </>
              )}
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
                <strong className="font-semibold">
                  {combo >= 5 ? "Unstoppable!" : combo >= COMBO_AT ? "On fire!" : "Correct!"}
                </strong>{" "}
                {gain ? `+${gain.points} XP` : "Nicely done."}
              </>
            ) : (
              <>
                Not quite. The answer is{" "}
                <AnswerName word={question.target} translation={translations.get(question.target)} lang={lang} />.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={next}
            disabled={saving}
            className={`${gotIt ? "btn-go" : "btn-primary"} shrink-0 px-6 py-3`}
          >
            {lastOfRound ? "See results" : "Next question"} &rarr;
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

const STAR_PATH = "m12 2.6 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.6Z";

function RoundSummary({ round, onAgain }: { round: Round; onAgain: () => void }) {
  const right = round.results.filter(Boolean).length;
  const stars = right >= 9 ? 3 : right >= 6 ? 2 : right >= 3 ? 1 : 0;
  const message = ["Keep practicing!", "Nice effort!", "Great work!", "Brilliant round!"][stars];
  const stats = [
    ["Right", `${right}/${round.results.length}`],
    ["XP earned", `+${round.xp}`],
    ["Best combo", `${round.bestCombo}`],
  ];
  return (
    <section className="animate-rise mx-auto max-w-lg text-center">
      <div className="card relative px-6 py-10">
        {stars >= 2 && <Confetti count={28} />}
        <p className="eyebrow">Round complete</p>
        <div className="mt-5 flex items-end justify-center gap-2" role="img" aria-label={`${stars} of 3 stars`}>
          {[1, 2, 3].map((n) => (
            <svg
              key={n}
              viewBox="0 0 24 24"
              aria-hidden
              strokeWidth="1"
              strokeLinejoin="round"
              style={{ animationDelay: `${n * 150}ms` }}
              className={`animate-streak-pop ${n === 2 ? "size-20" : "size-14"} ${
                n <= stars ? "fill-yellow-400 stroke-yellow-600 drop-shadow-md" : "fill-stone-200 stroke-stone-300"
              }`}
            >
              <path d={STAR_PATH} />
            </svg>
          ))}
        </div>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight">{message}</h1>
        <dl className="mt-8 grid grid-cols-3 gap-3">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200/70">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-stone-500">{k}</dt>
              <dd className="mt-1 font-serif text-2xl font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={onAgain} className="btn-go px-6 py-3">
            Play another round &rarr;
          </button>
          <Link href="/stats" className="btn-secondary px-6 py-3">
            See your stats
          </Link>
        </div>
      </div>
    </section>
  );
}
