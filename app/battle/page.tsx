"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type Word } from "@/lib/supabase";
import { useAccount } from "@/components/Account";
import { Loading } from "@/components/Status";
import { Confetti } from "@/components/Game";
import { awardBonus } from "@/lib/xp";
import {
  BATTLE_PRIZE,
  BATTLE_SECONDS,
  COUNTDOWN_SECONDS,
  ZERO,
  battleQuestions,
  enterRoom,
  setLobbyStatus,
  useRoom,
  useWaitingHosts,
  winnerOf,
  type Score,
} from "@/lib/battle";

export default function BattlePage() {
  const host = useRoom();
  const { account } = useAccount();
  if (!host) return <Menu me={account.username} />;
  return <Room key={host} host={host} me={account.username} />;
}

// ---- Menu --------------------------------------------------------------------

function Menu({ me }: { me: string }) {
  const hosts = useWaitingHosts();
  return (
    <section className="animate-rise">
      <p className="eyebrow text-accent">1v1</p>
      <h1 className="page-title mt-2">Word Battle</h1>
      <p className="mt-3 max-w-xl text-lg text-stone-600">
        Rapid fire: {BATTLE_SECONDS} seconds to match as many words to their meanings as you can.
        Most right wins <strong className="text-ink">+{BATTLE_PRIZE} XP</strong>.
      </p>

      <div className="card relative mt-8 overflow-hidden p-6 sm:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-orange-200/50 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-2xl font-semibold">Challenge someone</p>
            <p className="mt-1 text-stone-600">
              Everyone signed in gets an invite to join you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => enterRoom(me)}
            className="btn-go shrink-0 px-6 py-3 text-base"
          >
            ⚔ Find an opponent
          </button>
        </div>
      </div>

      <h2 className="eyebrow mt-10">Waiting for an opponent now</h2>
      {hosts.length === 0 ? (
        <p className="mt-3 text-stone-500">Nobody yet. Start one and they&rsquo;ll be notified.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {hosts.map((h) => (
            <li key={h.username} className="card flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-semibold">{h.username}</span>
              <button
                type="button"
                onClick={() => enterRoom(h.username)}
                className="btn-primary px-4 py-2"
              >
                Join
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- Room --------------------------------------------------------------------

type Phase = "connecting" | "lobby" | "countdown" | "playing" | "finishing" | "done" | "gone" | "full";
type Presence = { username: string; joined: number };

/** How long to wait for the other player's final score after time runs out. */
const FINAL_GRACE_MS = 3000;

function Room({ host, me }: { host: string; me: string }) {
  const isHost = host === me;

  const [phase, setPhase] = useState<Phase>("connecting");
  const [present, setPresent] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [mine, setMine] = useState<Score>(ZERO);
  const [theirs, setTheirs] = useState<Score>(ZERO);
  const [theirFinal, setTheirFinal] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const phaseRef = useRef(phase);
  const mineRef = useRef(mine);
  const startRef = useRef(startAt);
  const theirFinalRef = useRef(theirFinal);
  const awarded = useRef(new Set<number>());
  useEffect(() => {
    phaseRef.current = phase;
    mineRef.current = mine;
    startRef.current = startAt;
    theirFinalRef.current = theirFinal;
  });

  function go(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function begin(newSeed: number, opp: string) {
    const at = Date.now() + COUNTDOWN_SECONDS * 1000;
    startRef.current = at;
    theirFinalRef.current = false;
    setSeed(newSeed);
    setOpponent(opp);
    setMine(ZERO);
    setTheirs(ZERO);
    setTheirFinal(false);
    setQIndex(0);
    setPicked(null);
    setStartAt(at);
    setNow(Date.now());
    go("countdown");
  }

  // Join this battle's channel.
  useEffect(() => {
    const channel = supabase.channel(`wotd-battle:${host}`, {
      config: { presence: { key: me }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Presence>();
        const people = Object.values(state)
          .map((metas) => metas[0])
          .sort((a, b) => a.joined - b.joined)
          .map((p) => p.username);
        setPresent(people);
        const hostHere = people.includes(host);
        if (phaseRef.current === "connecting" && (isHost || hostHere)) go("lobby");
        if (!isHost && !hostHere && phaseRef.current === "lobby") go("gone");
      })
      .on("broadcast", { event: "start" }, ({ payload }) => {
        if (isHost) return;
        if (payload.guest !== me) return go("full");
        begin(payload.seed, host);
      })
      .on("broadcast", { event: "score" }, ({ payload }) => {
        if (payload.username !== me) setTheirs(payload.score);
      })
      .on("broadcast", { event: "final" }, ({ payload }) => {
        if (payload.username === me) return;
        setTheirs(payload.score);
        setTheirFinal(true);
        theirFinalRef.current = true;
        if (phaseRef.current === "finishing") go("done");
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ username: me, joined: Date.now() });
      });

    // A guest whose host never shows up gets told the battle is gone.
    const timeout = setTimeout(() => {
      if (!isHost && phaseRef.current === "connecting") go("gone");
    }, 4000);

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // `begin` and `go` only touch state setters and refs, so they never go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, me, isHost]);

  const others = present.filter((u) => u !== me);
  const inGame = phase === "countdown" || phase === "playing" || phase === "finishing";

  // Hosts advertise themselves in the lobby until someone joins.
  useEffect(() => {
    if (!isHost) return;
    setLobbyStatus(others.length > 0 || inGame ? "full" : "waiting");
  }, [isHost, others.length, inGame]);
  useEffect(() => () => setLobbyStatus("idle"), []);

  // Clock for the countdown and the battle; also moves between phases on time.
  useEffect(() => {
    if (!inGame) return;
    const id = setInterval(() => {
      const t = Date.now();
      const p = phaseRef.current;
      const end = startRef.current + BATTLE_SECONDS * 1000;
      setNow(t);
      if (p === "countdown" && t >= startRef.current) go("playing");
      if (p === "playing" && t >= end) {
        go("finishing");
        channelRef.current?.send({
          type: "broadcast",
          event: "final",
          payload: { username: me, score: mineRef.current },
        });
      }
      if (p === "finishing" && (theirFinalRef.current || t >= end + FINAL_GRACE_MS)) go("done");
    }, 100);
    return () => clearInterval(id);
  }, [inGame, me]);

  const endAt = startAt + BATTLE_SECONDS * 1000;

  const winner = opponent ? winnerOf([me, mine], [opponent, theirs]) : null;

  // Winner gets the prize, once per battle.
  useEffect(() => {
    if (phase !== "done" || winner !== me || awarded.current.has(seed)) return;
    awarded.current.add(seed);
    awardBonus(BATTLE_PRIZE);
  }, [phase, winner, me, seed]);

  const questions = useMemo(() => (seed ? battleQuestions(seed) : []), [seed]);
  const question = questions[qIndex % Math.max(questions.length, 1)];

  function start() {
    const guest = others[0];
    if (!guest) return;
    const newSeed = 1 + Math.floor(Math.random() * 2 ** 31);
    channelRef.current?.send({ type: "broadcast", event: "start", payload: { seed: newSeed, guest } });
    begin(newSeed, guest);
  }

  function answer(choice: Word, clickedAt: number) {
    if (phase !== "playing" || picked !== null || !question) return;
    const correct = choice.id === question.target.id;
    const score: Score = {
      right: mine.right + (correct ? 1 : 0),
      answered: mine.answered + 1,
      at: correct ? Math.round(clickedAt - startAt) : mine.at,
    };
    mineRef.current = score;
    setMine(score);
    setPicked(choice.id);
    channelRef.current?.send({ type: "broadcast", event: "score", payload: { username: me, score } });
    // A wrong answer shows the right one a little longer, as a small penalty.
    setTimeout(() => {
      setPicked(null);
      setQIndex((i) => i + 1);
    }, correct ? 250 : 900);
  }

  const leave = () => enterRoom(null);

  if (phase === "connecting") return <Loading />;

  if (phase === "gone" || phase === "full") {
    return (
      <section className="animate-rise card mx-auto max-w-md p-8 text-center">
        <p className="font-serif text-2xl font-semibold">
          {phase === "full" ? "That battle already started" : "That battle isn't open anymore"}
        </p>
        <p className="mt-2 text-stone-600">
          {phase === "full"
            ? `${host} is playing someone else. Start your own instead!`
            : `${host} isn't waiting right now. Start your own and they'll get an invite.`}
        </p>
        <button type="button" onClick={leave} className="btn-primary mt-6 px-6 py-3">
          Back to battles
        </button>
      </section>
    );
  }

  if (phase === "lobby") {
    const opp = isHost ? others[0] : host;
    return (
      <section className="animate-rise mx-auto max-w-lg text-center">
        <p className="eyebrow text-accent">Word Battle</p>
        <h1 className="page-title mt-2">{isHost && !opp ? "Waiting for a player…" : "Ready?"}</h1>
        <div className="card mt-8 flex items-center justify-around gap-4 px-6 py-8">
          <Player name={me} label="You" />
          <span className="font-serif text-3xl font-semibold italic text-stone-400">vs</span>
          {opp ? (
            <Player name={opp} label={isHost ? "Opponent" : "Host"} />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="grid size-16 place-items-center rounded-2xl bg-stone-100 ring-2 ring-dashed ring-stone-300">
                <span className="flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 animate-bounce rounded-full bg-stone-400"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </span>
              </span>
              <span className="text-sm text-stone-500">Searching</span>
            </div>
          )}
        </div>
        <p className="mt-5 text-stone-600" aria-live="polite">
          {isHost
            ? opp
              ? `${opp} is here. Press start when you're ready!`
              : "Everyone signed in just got an invite. Keep this page open."
            : `Waiting for ${host} to press Start…`}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {isHost && (
            <button type="button" onClick={start} disabled={!opp} className="btn-go px-8 py-3 text-base">
              Start battle &rarr;
            </button>
          )}
          <button type="button" onClick={leave} className="btn-secondary px-6 py-3">
            Leave
          </button>
        </div>
      </section>
    );
  }

  if (phase === "done" && opponent) {
    const won = winner === me;
    const draw = winner === null;
    const opponentHere = present.includes(opponent);
    return (
      <section className="animate-rise mx-auto max-w-lg text-center">
        <div className="card relative px-6 py-10">
          {won && <Confetti count={32} />}
          <p className="eyebrow">Battle over</p>
          <h1 className="mt-3 font-serif text-5xl font-semibold tracking-tight">
            {draw ? "It's a draw!" : won ? "You win!" : `${opponent} wins`}
          </h1>
          {won && (
            <p className="animate-streak-pop mt-4 inline-block rounded-full bg-yellow-400 px-4 py-1.5 text-lg font-extrabold text-yellow-950 shadow-sm">
              +{BATTLE_PRIZE} XP
            </p>
          )}
          {!won && !draw && <p className="mt-3 text-stone-600">So close. Get them in the rematch!</p>}
          <div className="mt-8 grid grid-cols-2 gap-3">
            <FinalScore name="You" score={mine} highlight={won} />
            <FinalScore name={opponent} score={theirs} highlight={winner === opponent} />
          </div>
          {!draw && mine.right === theirs.right && (
            <p className="mt-3 text-sm text-stone-500">Tied on score, so whoever got there first wins.</p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {isHost ? (
              <button
                type="button"
                onClick={start}
                disabled={!opponentHere}
                className="btn-go px-6 py-3"
              >
                {opponentHere ? "Rematch →" : `${opponent} left`}
              </button>
            ) : (
              <p className="self-center text-sm text-stone-500">
                {opponentHere ? `Waiting for ${host} to start a rematch…` : `${host} left.`}
              </p>
            )}
            <button type="button" onClick={leave} className="btn-secondary px-6 py-3">
              Leave
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Countdown, playing and finishing.
  const counting = phase === "countdown";
  const secondsLeft = counting
    ? Math.ceil((startAt - now) / 1000)
    : Math.max(0, Math.ceil((endAt - now) / 1000));
  const fraction = counting ? 1 : Math.max(0, (endAt - now) / (BATTLE_SECONDS * 1000));

  return (
    <section className="animate-rise">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <LiveScore name="You" score={mine.right} lead={mine.right > theirs.right} />
        <span
          className={`grid size-16 place-items-center rounded-full font-serif text-2xl font-bold tabular-nums ring-4 ${
            !counting && secondsLeft <= 10
              ? "animate-pulse bg-rose-50 text-rose-700 ring-rose-300"
              : "bg-white text-ink ring-stone-200"
          }`}
          aria-label={`${secondsLeft} seconds left`}
        >
          {counting ? "–" : secondsLeft}
        </span>
        <LiveScore name={opponent ?? ""} score={theirs.right} lead={theirs.right > mine.right} right />
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-stone-200">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            fraction < 1 / 6 ? "bg-rose-500" : "bg-linear-to-r from-orange-400 to-rose-500"
          }`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>

      {counting ? (
        <div className="grid place-items-center py-20">
          <p className="eyebrow">Get ready</p>
          <span key={secondsLeft} className="animate-streak-pop mt-2 font-serif text-8xl font-bold">
            {Math.max(secondsLeft, 1)}
          </span>
        </div>
      ) : phase === "finishing" ? (
        <div className="grid place-items-center py-20 text-center">
          <p className="font-serif text-4xl font-semibold">Time!</p>
          <p className="mt-2 text-stone-600">Tallying the scores…</p>
        </div>
      ) : (
        question && (
          <>
            <div key={qIndex} className="card animate-rise mt-6 px-6 py-6 sm:px-8 sm:py-8">
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
                  "bg-white ring-black/[0.08] shadow-[0_4px_0_0_rgb(0_0_0/0.08)] hover:-translate-y-0.5 hover:ring-ink active:translate-y-1 active:shadow-none";
                if (picked !== null) {
                  if (isAnswer) style = "bg-emerald-50 ring-2 ring-emerald-500 text-emerald-950";
                  else if (isPick) style = "animate-shake bg-rose-50 ring-2 ring-rose-400 text-rose-950";
                  else style = "bg-white/60 ring-black/[0.06] text-stone-400";
                }
                return (
                  <li key={`${qIndex}-${c.id}`}>
                    <button
                      type="button"
                      onClick={(e) => answer(c, performance.timeOrigin + e.timeStamp)}
                      disabled={picked !== null}
                      className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left ring-1 transition disabled:cursor-default ${style}`}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-sm font-bold text-stone-500">
                        {"ABCD"[i]}
                      </span>
                      <span className="font-serif text-xl font-medium">{c.word}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {opponent && !present.includes(opponent) && (
              <p className="alert-note mt-4">{opponent} disconnected. Keep going!</p>
            )}
          </>
        )
      )}
    </section>
  );
}

function Player({ name, label }: { name: string; label: string }) {
  return (
    <div className="animate-pop flex flex-col items-center gap-2">
      <span className="grid size-16 place-items-center rounded-2xl bg-ink font-serif text-3xl font-semibold text-amber-200 uppercase shadow-sm">
        {name[0]}
      </span>
      <span className="font-semibold">{name}</span>
      <span className="text-xs text-stone-500">{label}</span>
    </div>
  );
}

function LiveScore({ name, score, lead, right }: { name: string; score: number; lead: boolean; right?: boolean }) {
  return (
    <div className={`card min-w-0 px-4 py-3 ${right ? "text-right" : ""} ${lead ? "ring-2 ring-emerald-400" : ""}`}>
      <p className="truncate text-xs font-semibold uppercase tracking-wider text-stone-500">{name}</p>
      <p key={score} className={`font-serif text-3xl font-bold tabular-nums ${score ? "animate-pop" : ""}`}>
        {score}
      </p>
    </div>
  );
}

function FinalScore({ name, score, highlight }: { name: string; score: Score; highlight: boolean }) {
  return (
    <div
      className={`rounded-xl p-4 ring-1 ${
        highlight ? "bg-emerald-50 ring-emerald-300" : "bg-stone-50 ring-stone-200/70"
      }`}
    >
      <p className="truncate text-xs font-semibold uppercase tracking-wider text-stone-500">{name}</p>
      <p className="mt-1 font-serif text-4xl font-semibold tabular-nums">{score.right}</p>
      <p className="text-xs text-stone-500">of {score.answered} answered</p>
    </div>
  );
}
