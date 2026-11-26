"use client";

import { useEffect, useState } from "react";
import { StarIcon } from "@/components/Game";

const NAME = "wordoftheday";
// How long the splash stays up, then how long it takes to fade away.
const SHOW_MS = 1600;
const FADE_MS = 450;

/**
 * Full-screen loading screen shown when the app is opened or refreshed.
 * It lives in the root layout, so moving between pages doesn't bring it back.
 */
export default function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    const fade = setTimeout(() => setPhase("fade"), SHOW_MS);
    const gone = setTimeout(() => setPhase("gone"), SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-label="Loading wordoftheday"
      className={`splash fixed inset-0 z-50 grid place-items-center bg-(--page-bg) px-4 transition-opacity ${
        phase === "fade" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="flex flex-col items-center gap-7">
        {/* The logo: a big chunky letter tile with a star badge and sparkles. */}
        <div className="splash-logo relative">
          <span className="splash-sparkle absolute -top-5 -left-6 text-2xl text-amber-400" style={{ animationDelay: "0.5s" }}>
            ✦
          </span>
          <span className="splash-sparkle absolute -bottom-3 -left-8 text-lg text-sky-400" style={{ animationDelay: "0.8s" }}>
            ✦
          </span>
          <span className="splash-sparkle absolute top-2 -right-9 text-xl text-pink-400" style={{ animationDelay: "0.65s" }}>
            ✦
          </span>

          <div className="splash-tile grid size-32 place-items-center rounded-[2rem] bg-linear-to-br from-orange-400 to-orange-600 font-serif text-7xl font-bold text-white shadow-[0_9px_0_0_var(--color-orange-700),0_28px_40px_-18px_rgb(0_0_0/0.35)] ring-4 ring-white/40 ring-inset [text-shadow:0_3px_0_rgb(0_0_0/0.18)] sm:size-36 sm:text-8xl">
            W
          </div>
          <div className="splash-star absolute -top-4 -right-4 grid size-12 place-items-center rounded-full bg-white shadow-[0_4px_0_0_var(--color-stone-200)] ring-2 ring-stone-200">
            <StarIcon className="size-8" />
          </div>
        </div>

        {/* The name, one bouncy letter at a time, in the game's display face. */}
        <h1 className="flex font-serif text-4xl font-bold tracking-tight text-ink sm:text-5xl" aria-hidden>
          {NAME.split("").map((ch, i) => (
            <span
              key={i}
              className={`splash-letter ${i >= 4 && i < 9 ? "text-orange-500" : ""}`}
              style={{ animationDelay: `${0.25 + i * 0.05}s` }}
            >
              {ch}
            </span>
          ))}
        </h1>

        {/* Chunky progress bar, like a level-up meter. */}
        <div className="h-4 w-48 overflow-hidden rounded-full bg-white p-0.5 ring-2 ring-stone-200 shadow-[0_3px_0_0_var(--color-stone-200)]">
          <div
            className="splash-bar h-full rounded-full bg-linear-to-r from-amber-300 to-orange-500"
            style={{ animationDuration: `${SHOW_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
