"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StreakBadge } from "@/components/Streak";
import { LevelBadge } from "@/components/Game";

const icon = (d: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="size-5 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

type Tab = { href: string; label: string; short?: string; icon: ReactNode };

const links: Tab[] = [
  {
    href: "/",
    label: "Today",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </>,
    ),
  },
  {
    href: "/quiz",
    label: "Quiz",
    icon: icon(<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" fill="currentColor" />),
  },
  {
    href: "/isee",
    label: "ISEE Prep",
    short: "ISEE",
    icon: icon(
      <>
        <path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z" fill="currentColor" />
        <path d="M6.5 11v5c1.5 1.5 3.5 2.3 5.5 2.3s4-.8 5.5-2.3v-5M21.5 9v5" />
      </>,
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: icon(
      <>
        <rect x="3.5" y="12" width="4" height="8.5" rx="1.2" fill="currentColor" />
        <rect x="10" y="7" width="4" height="13.5" rx="1.2" fill="currentColor" />
        <rect x="16.5" y="3.5" width="4" height="17" rx="1.2" fill="currentColor" />
      </>,
    ),
  },
  {
    href: "/account",
    label: "Account",
    icon: icon(
      <>
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 20.5c1.2-3.6 4.3-5.5 8-5.5s6.8 1.9 8 5.5" />
      </>,
    ),
  },
];

export default function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-20 border-b-2 border-stone-200/70 bg-[color-mix(in_srgb,var(--page-bg)_85%,transparent)] backdrop-blur-md">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-orange-300"
          >
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-2xl bg-linear-to-br from-orange-400 to-orange-600 font-serif text-2xl font-bold text-white shadow-[0_4px_0_0_var(--color-orange-700)] transition-transform group-hover:-rotate-6 group-hover:scale-105"
            >
              W
            </span>
            <span className="hidden font-serif text-xl leading-none font-semibold tracking-tight text-ink sm:block">
              Word of the Day
            </span>
          </Link>

          {/* Tabs live here on wider screens; phones get the bottom bar. */}
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = isActive(l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-extrabold transition ${
                      active
                        ? "bg-orange-100 text-orange-700 ring-2 ring-orange-300"
                        : "text-stone-500 hover:bg-stone-900/5 hover:text-ink"
                    }`}
                  >
                    {l.icon}
                    <span className="hidden lg:inline">{l.label}</span>
                    <span className="lg:hidden">{l.short ?? l.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex shrink-0 items-center gap-2">
            <LevelBadge className="flex" />
            <StreakBadge />
          </div>
        </nav>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 px-2 py-1.5">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.7rem] font-extrabold transition ${
                    active ? "bg-orange-100 text-orange-600" : "text-stone-400 hover:text-stone-600"
                  }`}
                >
                  {l.icon}
                  {l.short ?? l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
