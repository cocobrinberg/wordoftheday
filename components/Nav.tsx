"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StreakBadge } from "@/components/Streak";

const links = [
  { href: "/", label: "Today" },
  { href: "/quiz", label: "Quiz" },
  { href: "/isee", label: "ISEE Prep" },
  { href: "/stats", label: "Stats" },
  { href: "/account", label: "Account" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-black/[0.06] bg-[color-mix(in_srgb,var(--page-bg)_80%,transparent)] backdrop-blur-md">
      <nav className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-lg bg-ink font-serif text-lg font-semibold italic text-amber-200 shadow-sm transition-transform group-hover:-rotate-6"
          >
            W
          </span>
          <span className="hidden font-serif text-lg font-semibold tracking-tight text-ink sm:inline">
            Word of the Day
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
        <StreakBadge />
        <ul className="flex min-w-0 gap-0.5 overflow-x-auto rounded-full bg-white/70 p-1 text-sm ring-1 ring-black/[0.06] shadow-sm [scrollbar-width:none]">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <li key={l.href} className="shrink-0">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-full px-2 py-1.5 text-[13px] font-medium transition-colors sm:px-3.5 sm:text-sm ${
                    active
                      ? "bg-ink text-stone-50 shadow-sm"
                      : "text-stone-600 hover:bg-stone-900/5 hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        </div>
      </nav>
    </header>
  );
}
