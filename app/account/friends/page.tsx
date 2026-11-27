"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/components/Account";
import { PlayerList, SubPageHeader } from "@/components/Follows";
import { Loading, ErrorMessage } from "@/components/Status";
import { findPlayers, type Player } from "@/lib/follows";

export default function FindFriendsPage() {
  const { token } = useAccount();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ query: string; players: Player[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Searches as you type, after a short pause.
  useEffect(() => {
    let live = true;
    const q = query.trim();
    const timer = setTimeout(
      () => {
        findPlayers(token, q)
          .then((players) => {
            if (!live) return;
            setResults({ query: q, players });
            setError(null);
          })
          .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
      },
      q ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token, query]);

  const update = (p: Player) =>
    setResults((r) => r && { ...r, players: r.players.map((x) => (x.username === p.username ? p : x)) });

  return (
    <section className="animate-rise mx-auto max-w-xl">
      <SubPageHeader eyebrow="Account" title="Find friends" />

      <label className="mt-6 block">
        <span className="sr-only">Search by username</span>
        <input
          type="search"
          className="input w-full"
          placeholder="Search by username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
        />
      </label>

      {error ? (
        <div className="mt-6">
          <ErrorMessage message={error} />
        </div>
      ) : !results ? (
        <Loading />
      ) : (
        <>
          <p className="mt-6 eyebrow">{results.query ? "Results" : "Newest players"}</p>
          <PlayerList
            players={results.players}
            onChange={update}
            empty={
              results.query ? (
                <>Nobody is called &ldquo;{results.query}&rdquo;.</>
              ) : (
                "Nobody else has joined yet."
              )
            }
          />
        </>
      )}
    </section>
  );
}
