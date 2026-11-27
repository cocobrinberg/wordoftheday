"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAccount } from "@/components/Account";
import { useMyConnections } from "@/components/Follows";

export default function AccountPage() {
  const { account } = useAccount();
  const { followers, following, loaded, error } = useMyConnections();
  const count = (n: number) => (loaded && !error ? n : "–");

  return (
    <section className="animate-rise mx-auto max-w-xl">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-orange-400 to-orange-600 font-serif text-3xl font-bold text-white uppercase shadow-[0_4px_0_0_var(--color-orange-700)]"
        >
          {account.username[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-accent">Account</p>
          <h1 className="mt-1 truncate font-serif text-4xl font-semibold tracking-tight">
            {account.username}
          </h1>
        </div>
        <Link
          href="/account/settings"
          className="btn-secondary shrink-0 gap-2 px-3.5 py-2 text-sm"
          aria-label="Settings"
        >
          <GearIcon />
          <span className="hidden sm:inline">Settings</span>
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <CountButton href="/account/followers" label="Followers" value={count(followers.length)} />
        <CountButton href="/account/following" label="Following" value={count(following.length)} />
      </div>

      <Link
        href="/account/friends"
        className="btn-primary mt-4 w-full gap-2 py-3.5 text-base"
      >
        <SearchIcon />
        Find my friends
      </Link>

      {error && <p className="alert-note mt-6">{error}</p>}
    </section>
  );
}

function CountButton({ href, label, value }: { href: string; label: string; value: ReactNode }) {
  return (
    <Link
      href={href}
      className="card block p-5 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
    >
      <span className="block font-serif text-4xl font-semibold tabular-nums">{value}</span>
      <span className="mt-1 block text-sm font-medium text-stone-600">{label}</span>
    </Link>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 4.3c.4-1.7 2.9-1.7 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 0 0 1 2.5c1.8.5 1.8 3 0 3.5a1.7 1.7 0 0 0-1 2.5c.9 1.6-.9 3.3-2.4 2.4a1.7 1.7 0 0 0-2.6 1.1c-.5 1.7-3 1.7-3.4 0a1.7 1.7 0 0 0-2.6-1.1c-1.5.9-3.3-.8-2.4-2.4a1.7 1.7 0 0 0-1-2.5c-1.8-.5-1.8-3 0-3.5a1.7 1.7 0 0 0 1-2.5c-.9-1.6.9-3.3 2.4-2.4a1.7 1.7 0 0 0 2.6-1.1Z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}
