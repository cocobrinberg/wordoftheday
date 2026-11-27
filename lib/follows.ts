"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

/** Another player, seen from the signed-in account. */
export type Player = { username: string; i_follow: boolean; follows_me: boolean };

/** Thrown until supabase/follows.sql has been run. */
export class FollowsNotSetUp extends Error {
  constructor() {
    super("Following isn't set up in the database yet. Run supabase/follows.sql in Supabase.");
  }
}

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "PGRST202" || error.message.includes("Could not find the function")) {
    throw new FollowsNotSetUp();
  }
  throw new Error(error.message);
}

const toPlayers = (data: unknown) =>
  ((data ?? []) as Player[]).map((p) => ({
    username: p.username,
    i_follow: Boolean(p.i_follow),
    follows_me: Boolean(p.follows_me),
  }));

/** Players whose name contains `query`, or the newest players when it's empty. */
export async function findPlayers(token: string, query: string): Promise<Player[]> {
  const { data, error } = await supabase.rpc("find_players", { p_token: token, p_query: query });
  check(error);
  return toPlayers(data);
}

// The signed-in account's followers and following, shared by every page so
// the counts and buttons stay in step when someone is followed.

type Connections = { players: Player[]; error: string | null; loaded: boolean };
const EMPTY: Connections = { players: [], error: null, loaded: false };

let state: Connections = EMPTY;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

function set(next: Connections) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useConnections(): Connections {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

/** Loads followers and following for `token`, unless they're already loaded. */
export async function loadConnections(token: string, force = false) {
  if (!force && loadedFor === token && state.loaded) return;
  loadedFor = token;
  try {
    const { data, error } = await supabase.rpc("my_connections", { p_token: token });
    check(error);
    if (loadedFor === token) set({ players: toPlayers(data), error: null, loaded: true });
  } catch (e) {
    if (loadedFor === token) set({ ...state, error: e instanceof Error ? e.message : String(e), loaded: true });
  }
}

export function clearConnections() {
  loadedFor = null;
  set(EMPTY);
}

/** Follows or unfollows `username`, updating every page at once. */
export async function setFollow(token: string, player: Player, follow: boolean): Promise<Player> {
  const { error } = await supabase.rpc("set_follow", {
    p_token: token,
    p_username: player.username,
    p_follow: follow,
  });
  check(error);
  const updated = { ...player, i_follow: follow };
  const others = state.players.filter((p) => p.username !== player.username);
  const keep = updated.i_follow || updated.follows_me;
  set({
    ...state,
    players: (keep ? [...others, updated] : others).sort((a, b) => a.username.localeCompare(b.username)),
  });
  return updated;
}
