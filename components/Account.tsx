"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { applyTheme } from "@/lib/theme";
import { Loading } from "@/components/Status";
import { StreakSync } from "@/components/Streak";
import { XpSync } from "@/components/Game";

const TOKEN_KEY = "wotd-session";
const BG_KEY = "wotd-background";
export const DEFAULT_BACKGROUND = "#f0f9ff";

export const BACKGROUNDS = [
  { name: "Sky", value: "#f0f9ff" },
  { name: "White", value: "#ffffff" },
  { name: "Sand", value: "#f5f5f4" },
  { name: "Butter", value: "#fef9c3" },
  { name: "Peach", value: "#ffedd5" },
  { name: "Rose", value: "#ffe4e6" },
  { name: "Lavender", value: "#ede9fe" },
  { name: "Mint", value: "#dcfce7" },
];

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type Account = { username: string; background: string; hobbies: string[] | null };

export const HOBBY_COUNT = 5;

type AccountContext = {
  account: Account;
  /** Session token for calls that act as this account. */
  token: string;
  setBackground: (hex: string) => Promise<void>;
  setHobbies: (hobbies: string[]) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AccountContext | null>(null);

export function useAccount() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccount must be used inside <AccountGate>");
  return ctx;
}

function storage(key: string, value?: string | null) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
  return null;
}

function applyBackground(hex: string) {
  applyTheme(hex);
  storage(BG_KEY, hex);
}

function friendly(message: string) {
  if (message.includes("Could not find the function") && message.includes("set_hobbies")) {
    return "Hobbies aren't set up in the database yet. Run supabase/hobbies.sql in Supabase.";
  }
  if (message.includes("Could not find the function")) {
    return "Accounts aren't set up in the database yet. Run supabase/accounts.sql in Supabase.";
  }
  return message;
}

/**
 * Requires an account before showing the app. New accounts then pick a
 * background color, which is saved to the account and applied to the page.
 */
export default function AccountGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [pickingColor, setPickingColor] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = storage(BG_KEY);
    if (saved) applyBackground(saved);

    const t = storage(TOKEN_KEY);
    const lookup = t
      ? supabase.rpc("get_account", { p_token: t })
      : Promise.resolve({ data: null, error: null });
    lookup.then(({ data, error }) => {
      const row = t && !error && Array.isArray(data) ? data[0] : null;
      if (!row) {
        storage(TOKEN_KEY, null);
        return setAccount(null);
      }
      setToken(t);
      setAccount(row);
      applyBackground(row.background);
    });
  }, []);

  async function signedIn(t: string, isNew: boolean) {
    storage(TOKEN_KEY, t);
    const { data, error } = await supabase.rpc("get_account", { p_token: t });
    if (error || !data?.[0]) throw new Error(error?.message ?? "Couldn't load your account");
    setToken(t);
    setAccount(data[0]);
    applyBackground(data[0].background);
    setPickingColor(isNew);
    // Land on the Today tab once setup (hobbies, background) is finished.
    // The gate keeps showing the setup screens until then, so switching the
    // URL now means the first page the user sees afterwards is Today.
    router.replace("/");
  }

  async function setBackground(hex: string) {
    if (!token || !account) return;
    const previous = account.background;
    setAccount({ ...account, background: hex });
    applyBackground(hex);
    const { error } = await supabase.rpc("set_background", { p_token: token, p_background: hex });
    if (error) {
      setAccount({ ...account, background: previous });
      applyBackground(previous);
      throw new Error(friendly(error.message));
    }
  }

  async function setHobbies(hobbies: string[]) {
    if (!token || !account) return;
    const { error } = await supabase.rpc("set_hobbies", { p_token: token, p_hobbies: hobbies });
    if (error) throw new Error(friendly(error.message));
    const { data } = await supabase.rpc("get_account", { p_token: token });
    setAccount(data?.[0] ?? { ...account, hobbies });
  }

  async function signOut() {
    if (token) await supabase.rpc("sign_out", { p_token: token });
    storage(TOKEN_KEY, null);
    setToken(null);
    setAccount(null);
    applyBackground(DEFAULT_BACKGROUND);
  }

  if (account === undefined) {
    return <Loading />;
  }
  if (!account) return <AuthForm onSignedIn={signedIn} />;

  const value = { account, token: token!, setBackground, setHobbies, signOut };
  const needsHobbies = (account.hobbies?.length ?? 0) < HOBBY_COUNT;
  return (
    <Ctx.Provider value={value}>
      <StreakSync token={token!} />
      <XpSync token={token!} username={account.username} />
      {needsHobbies ? (
        <section className="animate-rise mx-auto max-w-md">
          <StepLabel step={1} />
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">
            What do you love doing?
          </h1>
          <p className="mt-2 text-stone-600">
            Tell us five of your hobbies and we&rsquo;ll pick words of the day that match your
            interests.
          </p>
          <div className="card mt-8 p-6">
            <HobbiesForm submitLabel="Continue" />
          </div>
        </section>
      ) : pickingColor ? (
        <section className="animate-rise mx-auto max-w-md">
          <StepLabel step={2} />
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">
            Welcome, {account.username}!
          </h1>
          <p className="mt-2 text-stone-600">Pick a background color. You can change it later.</p>
          <div className="card mt-8 p-6">
            <BackgroundPicker />
          </div>
          <button
            type="button"
            onClick={() => setPickingColor(false)}
            className="btn-primary mt-6 w-full py-3"
          >
            Start learning &rarr;
          </button>
        </section>
      ) : (
        children
      )}
    </Ctx.Provider>
  );
}

function AuthForm({ onSignedIn }: { onSignedIn: (token: string, isNew: boolean) => Promise<void> }) {
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [availability, setAvailability] = useState<{ name: string; free: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const name = username.trim().toLowerCase();
  const validName = USERNAME_RE.test(name);
  const creating = mode === "create";

  // Check availability shortly after the user stops typing.
  useEffect(() => {
    if (!creating || !validName) return;
    const id = setTimeout(() => {
      supabase.rpc("username_available", { p_username: name }).then(({ data, error }) => {
        if (error) return setError(friendly(error.message));
        setError(null);
        setAvailability({ name, free: data === true });
      });
    }, 300);
    return () => clearTimeout(id);
  }, [name, validName, creating]);

  const checked = availability?.name === name ? availability : null;
  const canSubmit =
    !busy && validName && password.length >= 8 && (!creating || checked?.free === true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc(creating ? "create_account" : "sign_in", {
      p_username: name,
      p_password: password,
    });
    try {
      if (error) throw new Error(friendly(error.message));
      await onSignedIn(data as string, creating);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  let hint: ReactNode = "3–20 letters, numbers or underscores.";
  let hintColor = "text-stone-500";
  if (creating && username && !validName) hintColor = "text-amber-700";
  else if (creating && validName && !checked) hint = "Checking…";
  else if (creating && checked?.free) {
    hint = `“${name}” is available.`;
    hintColor = "text-emerald-700";
  } else if (creating && checked) {
    hint = `“${name}” is taken. Try another.`;
    hintColor = "text-rose-700";
  }

  const input = "input mt-1.5";

  return (
    <section className="animate-rise mx-auto grid max-w-4xl items-center gap-10 md:grid-cols-[1fr_minmax(0,26rem)] md:gap-14">
      <div className="hidden md:block">
        <p className="eyebrow text-accent">Word of the Day</p>
        <p className="mt-4 font-serif text-6xl leading-none font-semibold tracking-tight">
          sesquipedalian
        </p>
        <p className="mt-3 font-serif text-lg italic text-stone-500">
          /ˌsɛs.kwɪ.pəˈdeɪ.li.ən/ &middot; adjective
        </p>
        <p className="mt-6 max-w-sm text-lg leading-relaxed text-stone-700">
          Given to using long words. Become one: a new word every day, chosen around your hobbies,
          plus a quiz to make it stick.
        </p>
      </div>

      <div className="card p-6 sm:p-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        {creating ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-stone-600">
        {creating
          ? "Pick a username and password to start learning a word a day."
          : "Sign in to see today's word."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-semibold text-stone-700">Username</span>
          <input
            className={input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            required
          />
          {creating && (
            <span className={`mt-1 block text-sm ${hintColor}`} aria-live="polite">
              {hint}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-stone-700">Password</span>
          <input
            className={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={creating ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          {creating && (
            <span
              className={`mt-1 block text-sm ${
                password && password.length < 8 ? "text-amber-700" : "text-stone-500"
              }`}
            >
              At least 8 characters.
            </span>
          )}
        </label>

        {error && <p className="alert-error">{error}</p>}

        <button type="submit" disabled={!canSubmit} className="btn-primary w-full py-3">
          {busy ? "One moment…" : creating ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-600">
        {creating ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(creating ? "signin" : "create");
            setError(null);
          }}
          className="link"
        >
          {creating ? "Sign in" : "Create an account"}
        </button>
      </p>
      </div>
    </section>
  );
}

export function BackgroundPicker() {
  const { account, setBackground } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const current = account.background.toLowerCase();

  function choose(hex: string) {
    setError(null);
    setBackground(hex.toLowerCase()).catch((e: Error) => setError(e.message));
  }

  return (
    <fieldset>
      <legend className="eyebrow">Background color</legend>
      <div className="mt-3 grid grid-cols-4 gap-3">
        {BACKGROUNDS.map((c) => {
          const active = c.value === current;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => choose(c.value)}
              aria-pressed={active}
              className={`group flex flex-col items-center gap-1.5 text-xs ${
                active ? "font-semibold text-ink" : "text-stone-600"
              }`}
            >
              <span
                className={`grid h-12 w-full place-items-center rounded-xl ring-1 transition ${
                  active
                    ? "ring-2 ring-ink ring-offset-2"
                    : "ring-black/10 group-hover:-translate-y-0.5 group-hover:shadow-md"
                }`}
                style={{ backgroundColor: c.value }}
              >
                {active && <span className="text-base text-ink">✓</span>}
              </span>
              {c.name}
            </button>
          );
        })}
      </div>
      <label className="mt-4 flex items-center gap-3 text-sm text-stone-600">
        <input
          type="color"
          value={current}
          onChange={(e) => choose(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-white p-0.5 ring-1 ring-stone-300"
        />
        Or pick any color
      </label>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </fieldset>
  );
}

const HOBBY_EXAMPLES = ["cooking", "rock climbing", "chess", "gardening", "photography"];

/** Five text boxes for hobbies, saved to the account. */
export function HobbiesForm({
  submitLabel = "Save hobbies",
  onSaved,
}: {
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const { account, setHobbies } = useAccount();
  const [values, setValues] = useState<string[]>(() =>
    Array.from({ length: HOBBY_COUNT }, (_, i) => account.hobbies?.[i] ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const cleaned = values.map((v) => v.trim().toLowerCase());
  const filled = cleaned.filter(Boolean);
  const unique = new Set(filled).size === filled.length;
  const canSubmit = !busy && filled.length === HOBBY_COUNT && unique;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await setHobbies(cleaned);
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {values.map((v, i) => (
        <label key={i} className="flex items-center gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
            {i + 1}
          </span>
          <input
            value={v}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              setValues(next);
              setSaved(false);
            }}
            placeholder={`e.g. ${HOBBY_EXAMPLES[i]}`}
            aria-label={`Hobby ${i + 1}`}
            maxLength={40}
            required
            className="input"
          />
        </label>
      ))}
      {!unique && <p className="text-sm text-amber-700">Each hobby should be different.</p>}
      {error && <p className="alert-error">{error}</p>}
      <button type="submit" disabled={!canSubmit} className="btn-primary mt-3 w-full py-3">
        {busy ? "Saving…" : submitLabel}
      </button>
      {saved && !onSaved && <p className="text-center text-sm text-emerald-700">Saved.</p>}
    </form>
  );
}

function StepLabel({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow">Step {step} of 2</span>
      <span className="flex gap-1" aria-hidden>
        {[1, 2].map((n) => (
          <span key={n} className={`h-1 w-8 rounded-full ${n <= step ? "bg-ink" : "bg-stone-300"}`} />
        ))}
      </span>
    </div>
  );
}
