"use client";

import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type Word } from "@/lib/supabase";
import { WORD_BANK } from "@/lib/wordBank";

/**
 * 1v1 battles, run entirely over Supabase Realtime (no database tables).
 *
 * - Everyone signed in joins the "lobby" presence channel. A player waiting for
 *   an opponent marks themselves `waiting`, and everyone else sees an invite.
 * - Each battle has its own channel, `battle:<host>`. Both players track
 *   presence there; the host broadcasts `start`, then each answer is broadcast
 *   so both screens show live scores.
 */

export const BATTLE_SECONDS = 60;
export const COUNTDOWN_SECONDS = 3;
export const BATTLE_PRIZE = 100;

export type LobbyStatus = "idle" | "waiting" | "full";
type LobbyMeta = { username: string; status: LobbyStatus; since: number };

let lobby: RealtimeChannel | null = null;
let me: LobbyMeta | null = null;
let waitingHosts: LobbyMeta[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readLobby() {
  if (!lobby || !me) return;
  const state = lobby.presenceState<LobbyMeta>();
  const hosts = new Map<string, LobbyMeta>();
  for (const metas of Object.values(state)) {
    for (const m of metas) {
      if (m.username !== me.username && m.status === "waiting") hosts.set(m.username, m);
    }
  }
  waitingHosts = [...hosts.values()].sort((a, b) => a.since - b.since);
  emit();
}

/** Joins the lobby as `username`. Returns a function that leaves it. */
export function joinLobby(username: string) {
  me = { username, status: "idle", since: Date.now() };
  const channel = supabase.channel("wotd-lobby", { config: { presence: { key: username } } });
  lobby = channel;
  channel
    .on("presence", { event: "sync" }, readLobby)
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && me) channel.track(me);
    });
  return () => {
    supabase.removeChannel(channel);
    if (lobby === channel) {
      lobby = null;
      me = null;
      waitingHosts = [];
      emit();
    }
  };
}

/** Tells everyone in the lobby whether you're waiting for an opponent. */
export function setLobbyStatus(status: LobbyStatus) {
  if (!me || me.status === status) return;
  me = { ...me, status, since: Date.now() };
  lobby?.track(me);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// The battle room the player is in: their own (hosting) or someone else's.
let room: string | null = null;

/** Opens a battle room (`host` is whose room), or closes it with null. */
export function enterRoom(host: string | null) {
  room = host;
  emit();
}

export function useRoom(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => room,
    () => null,
  );
}

const NONE: LobbyMeta[] = [];

/** Other players who are waiting for an opponent right now, longest-waiting first. */
export function useWaitingHosts(): LobbyMeta[] {
  return useSyncExternalStore(
    subscribe,
    () => waitingHosts,
    () => NONE,
  );
}

// ---- Questions ---------------------------------------------------------------

/** Small seeded random generator (mulberry32), so both players get the same questions. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type BattleQuestion = { target: Word; choices: Word[] };

/** The same list of questions for any given seed. */
export function battleQuestions(seed: number, count = 120): BattleQuestion[] {
  const rand = rng(seed);
  const order = shuffle(WORD_BANK, rand);
  return Array.from({ length: count }, (_, i) => {
    const target = order[i % order.length];
    const others = shuffle(
      WORD_BANK.filter((w) => w.id !== target.id),
      rand,
    ).slice(0, 3);
    return { target, choices: shuffle([target, ...others], rand) };
  });
}

// ---- Results -----------------------------------------------------------------

/** A player's score; `at` is ms into the battle when they reached it (for tie-breaks). */
export type Score = { right: number; answered: number; at: number };

export const ZERO: Score = { right: 0, answered: 0, at: 0 };

/**
 * Who won: most right answers, and on a tie whoever got there first.
 * Returns null for a draw (same score at the same moment, or nobody scored).
 */
export function winnerOf(a: [string, Score], b: [string, Score]): string | null {
  const [an, as] = a;
  const [bn, bs] = b;
  if (as.right !== bs.right) return as.right > bs.right ? an : bn;
  if (as.right === 0 || as.at === bs.at) return null;
  return as.at < bs.at ? an : bn;
}
