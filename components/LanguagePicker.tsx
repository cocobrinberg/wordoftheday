"use client";

import { useSyncExternalStore } from "react";
import { ENGLISH, LANGUAGES, findLanguage, type Language } from "@/lib/languages";

const STORAGE_KEY = "wotd-language";

const listeners = new Set<() => void>();
let memory: string | null = null; // fallback when localStorage is unavailable

function readCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** The chosen language, remembered in this browser. */
export function useLanguage(): [Language, (l: Language) => void] {
  const code = useSyncExternalStore(subscribe, readCode, () => null);
  const lang = findLanguage(code) ?? ENGLISH;

  function choose(l: Language) {
    memory = l.code;
    try {
      localStorage.setItem(STORAGE_KEY, l.code);
    } catch {}
    listeners.forEach((cb) => cb());
  }

  return [lang, choose];
}

export default function LanguagePicker({
  value,
  onChange,
}: {
  value: Language;
  onChange: (l: Language) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Language</legend>
      <div className="inline-flex flex-wrap gap-0.5 rounded-full bg-white/70 p-1 ring-1 ring-black/[0.06] shadow-sm">
        {LANGUAGES.map((l) => {
          const active = l.code === value.code;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => onChange(l)}
              aria-pressed={active}
              title={l.name}
              lang={l.code}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-ink text-stone-50 shadow-sm"
                  : "text-stone-600 hover:bg-stone-900/5 hover:text-ink"
              }`}
            >
              {l.native}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
