"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { enterRoom, joinLobby, useWaitingHosts } from "@/lib/battle";

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
          className="animate-streak-pop grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-orange-400 to-rose-500 text-xl text-white shadow-sm"
        >
          ⚔
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
