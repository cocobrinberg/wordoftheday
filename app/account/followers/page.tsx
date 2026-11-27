"use client";

import Link from "next/link";
import { PlayerList, SubPageHeader, useMyConnections } from "@/components/Follows";
import { Loading, ErrorMessage } from "@/components/Status";

export default function FollowersPage() {
  const { followers, loaded, error } = useMyConnections();
  return (
    <section className="animate-rise mx-auto max-w-xl">
      <SubPageHeader eyebrow="Account" title="Followers" />
      {error ? (
        <div className="mt-6">
          <ErrorMessage message={error} />
        </div>
      ) : !loaded ? (
        <Loading />
      ) : (
        <PlayerList
          players={followers}
          empty={
            <>
              Nobody follows you yet.{" "}
              <Link href="/account/friends" className="link">
                Find friends
              </Link>{" "}
              to get started.
            </>
          }
        />
      )}
    </section>
  );
}
