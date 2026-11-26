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
 * Full-width Battle banner shown just under the header on every page except
 * the Battle page itself. Says who's waiting when someone wants a match.
 */
export function BattleBanner() {
  const hosts = useWaitingHosts();
  const pathname = usePathname();
  if (pathname.startsWith("/battle")) return null;
  const first = hosts[0]?.username;
  const others = hosts.length - 1;

  return (
    <Link
      href="/battle"
      className="group relative mb-6 flex items-center gap-4 overflow-hidden rounded-3xl bg-linear-to-br from-rose-500 via-rose-500 to-orange-500 p-3 pr-4 text-white shadow-[0_5px_0_0_var(--color-rose-700),0_16px_30px_-14px_rgb(from_var(--color-rose-600)_r_g_b/0.9)] ring-1 ring-rose-700/30 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_7px_0_0_var(--color-rose-700),0_20px_34px_-14px_rgb(from_var(--color-rose-600)_r_g_b/0.9)] active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-rose-700)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-rose-300 sm:mb-8 sm:p-4 sm:pr-5"
    >
      {/* Shine and a glow behind the icon. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/20 to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-6 size-32 rounded-full bg-yellow-300/40 blur-2xl"
      />

      <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/40 sm:size-14">
        <SwordsIcon className="size-6 drop-shadow-[0_1px_0_rgb(0_0_0/0.25)] transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110 sm:size-7" />
        {first && (
          <span aria-hidden className="absolute -top-1 -right-1 flex size-4">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-yellow-300 opacity-75" />
            <span className="relative inline-flex size-4 rounded-full bg-yellow-300 ring-2 ring-rose-500" />
          </span>
        )}
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="block font-serif text-lg leading-tight font-bold drop-shadow-[0_1px_0_rgb(0_0_0/0.15)] sm:text-xl">
          {first ? (
            <>
              {first}
              {others > 0 ? ` + ${others} more want` : " wants"} to battle!
            </>
          ) : (
            "1v1 Word Battle"
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-white/85">
          {first ? "Jump in before someone else does" : "60 seconds, rapid fire. Winner gets +100 XP"}
        </span>
      </span>

      <span className="relative shrink-0 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-rose-600 shadow-[0_3px_0_0_rgb(0_0_0/0.15)] transition-transform group-hover:scale-105">
        {first ? "Join" : "Play"} <span aria-hidden>&rarr;</span>
      </span>
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
