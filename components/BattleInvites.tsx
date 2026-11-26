"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { enterRoom, joinLobby, useWaitingHosts } from "@/lib/battle";

export function SwordsIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
      <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
      <path d="m5 14 4 4" />
      <path d="m7 17-3 3" />
      <path d="m3 19 2 2" />
    </svg>
  );
}

/**
 * The Battle button: a chunky red-orange pill that pings when someone is
 * waiting for an opponent. `compact` hides the label on small screens.
 */
export function BattleButton({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const hosts = useWaitingHosts();
  const pathname = usePathname();
  const active = pathname.startsWith("/battle");
  const waiting = hosts.length > 0;
  const label = waiting
    ? `1v1 Battle: ${hosts.length} player${hosts.length > 1 ? "s" : ""} waiting`
    : "1v1 Battle";
  return (
    <Link
      href="/battle"
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`group relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-linear-to-b from-rose-400 to-rose-600 py-1.5 font-bold text-white ring-1 ring-rose-600/40 shadow-[0_3px_0_0_var(--color-rose-700),0_8px_18px_-8px_rgb(from_var(--color-rose-600)_r_g_b/0.8)] transition-all duration-150 hover:-translate-y-px hover:from-rose-300 hover:to-rose-500 hover:shadow-[0_4px_0_0_var(--color-rose-700),0_10px_20px_-8px_rgb(from_var(--color-rose-600)_r_g_b/0.9)] active:translate-y-[2px] active:shadow-[0_1px_0_0_var(--color-rose-700)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${
        compact ? "px-2 text-sm sm:px-3" : "px-4 text-sm"
      } ${active ? "ring-2 ring-white/80" : ""} ${className}`}
    >
      {/* Soft shine across the top half. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-full bg-linear-to-b from-white/35 to-transparent"
      />
      <SwordsIcon className="relative size-4 drop-shadow-[0_1px_0_rgb(0_0_0/0.2)] transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" />
      <span className={`relative drop-shadow-[0_1px_0_rgb(0_0_0/0.2)] ${compact ? "hidden sm:inline" : ""}`}>
        Battle
      </span>
      {waiting && (
        <span aria-hidden className="absolute -top-1 -right-1 flex size-3.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-yellow-300 opacity-75" />
          <span className="relative inline-flex size-3.5 rounded-full bg-yellow-300 ring-2 ring-white" />
        </span>
      )}
    </Link>
  );
}

/**
 * Keeps the signed-in player in the battle lobby and pops up an invite
 * whenever someone else is waiting for an opponent.
 */
export default function BattleInvites({ username }: { username: string }) {
  const hosts = useWaitingHosts();
  const pathname = usePathname();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => joinLobby(username), [username]);

  // The Battle page lists waiting players itself.
  if (pathname.startsWith("/battle")) return null;
  const host = hosts.find((h) => !dismissed.has(`${h.username}:${h.since}`));
  if (!host) return null;
  const id = `${host.username}:${host.since}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-rise fixed inset-x-4 bottom-4 z-20 mx-auto max-w-sm sm:right-6 sm:left-auto sm:mx-0"
    >
      <div className="card flex items-center gap-3 p-3 pr-2 ring-2 ring-orange-300">
        <span
          aria-hidden
          className="animate-streak-pop grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-orange-400 to-rose-500 text-white shadow-sm"
        >
          <SwordsIcon className="size-5" />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug text-stone-700">
          <strong className="font-semibold text-ink">{host.username}</strong> wants a 1v1 word
          battle!
        </p>
        <button
          type="button"
          onClick={() => {
            enterRoom(host.username);
            router.push("/battle");
          }}
          className="btn-go shrink-0 px-4 py-2"
        >
          Join
        </button>
        <button
          type="button"
          onClick={() => setDismissed((d) => new Set(d).add(id))}
          aria-label="Dismiss invite"
          className="grid size-8 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
