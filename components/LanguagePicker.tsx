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
      <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-white p-1 ring-2 ring-stone-200 shadow-[0_4px_0_0_var(--color-stone-200)]">
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
              className={`rounded-xl px-3 py-1.5 text-sm font-extrabold transition ${
                active
                  ? "bg-orange-500 text-white shadow-[0_3px_0_0_var(--color-orange-700)]"
                  : "text-stone-500 hover:bg-stone-100 hover:text-ink"
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
