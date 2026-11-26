import Link from "next/link";

/** A small white house that opens the suggestion page. Sits beside the language options. */
export default function SuggestButton() {
  return (
    <Link
      href="/suggest"
      aria-label="Suggest a word of the day"
      className="group relative inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <svg
        viewBox="0 0 40 40"
        aria-hidden
        className="size-10 origin-bottom drop-shadow-[0_2px_3px_rgb(28_25_23/0.18)] transition-all duration-200 ease-out group-hover:scale-125 group-hover:drop-shadow-[0_10px_14px_rgb(28_25_23/0.32)] group-focus-visible:scale-125 group-active:scale-110"
      >
        {/* Roof and walls in one white shape */}
        <path
          d="M20 3 L37 18 Q38.5 19.5 36.5 19.5 L33 19.5 L33 35 Q33 37 31 37 L9 37 Q7 37 7 35 L7 19.5 L3.5 19.5 Q1.5 19.5 3 18 Z"
          fill="white"
          stroke="rgb(28 25 23 / 0.1)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* Door */}
        <rect x="16.5" y="25" width="7" height="12" rx="1.5" fill="var(--accent)" />
      </svg>
      {/* Label that appears below on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink opacity-0 shadow-[0_6px_16px_-6px_rgb(28_25_23/0.35)] ring-1 ring-black/[0.06] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
      >
        Suggest a word
      </span>
    </Link>
  );
}
