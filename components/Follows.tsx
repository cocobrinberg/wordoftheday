"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount } from "@/components/Account";
import { loadConnections, setFollow, useConnections, type Player } from "@/lib/follows";

/** The signed-in account's followers and following, reloaded each time the page is shown. */
export function useMyConnections() {
  const { token } = useAccount();
  const connections = useConnections();
  useEffect(() => {
    loadConnections(token, true).catch(() => {});
  }, [token]);
  const followers = connections.players.filter((p) => p.follows_me);
  const following = connections.players.filter((p) => p.i_follow);
  return { ...connections, followers, following };
}

/** Title row for an Account sub page, with a way back. */
export function SubPageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div>
      <Link href="/account" className="link inline-flex items-center gap-1 text-sm">
        <span aria-hidden>&larr;</span> Account
      </Link>
      <p className="eyebrow mt-4 text-accent">{eyebrow}</p>
      <h1 className="page-title mt-1">{title}</h1>
      {children}
    </div>
  );
}

export function Avatar({ name, size = "size-10 text-xl" }: { name: string; size?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-xl bg-linear-to-br from-orange-400 to-orange-600 font-serif font-bold text-white uppercase ${size}`}
    >
      {name[0]}
    </span>
  );
}

function FollowButton({ player, onChange }: { player: Player; onChange: (p: Player) => void }) {
  const { token } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = player.i_follow ? "Following" : player.follows_me ? "Follow back" : "Follow";

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      onChange(await setFollow(token, player, !player.i_follow));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={player.i_follow}
        aria-label={`${player.i_follow ? "Unfollow" : "Follow"} ${player.username}`}
        className={`${player.i_follow ? "btn-secondary" : "btn-primary"} px-4 py-1.5 text-sm disabled:opacity-60`}
      >
        {busy ? "…" : label}
      </button>
      {error && <span className="max-w-48 text-right text-xs text-rose-700">{error}</span>}
    </span>
  );
}

/** A list of players, each with a follow button. */
export function PlayerList({
  players,
  empty,
  onChange,
}: {
  players: Player[];
  empty: ReactNode;
  onChange?: (p: Player) => void;
}) {
  if (players.length === 0) return <div className="card mt-6 p-6 text-center text-stone-600">{empty}</div>;
  return (
    <ul className="card mt-6 divide-y divide-stone-200/70 overflow-hidden">
      {players.map((p) => (
        <li key={p.username} className="flex items-center gap-3 px-5 py-3.5">
          <Avatar name={p.username} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{p.username}</span>
            {p.follows_me && p.i_follow ? (
              <span className="text-xs text-stone-500">Friends: you follow each other</span>
            ) : p.follows_me ? (
              <span className="text-xs text-stone-500">Follows you</span>
            ) : null}
          </span>
          <FollowButton player={p} onChange={onChange ?? (() => {})} />
        </li>
      ))}
    </ul>
  );
}
