"use client";

import Link from "next/link";
import { PlayerList, SubPageHeader, useMyConnections } from "@/components/Follows";
import { Loading, ErrorMessage } from "@/components/Status";

export default function FollowingPage() {
  const { following, loaded, error } = useMyConnections();
  return (
    <section className="animate-rise mx-auto max-w-xl">
      <SubPageHeader eyebrow="Account" title="Following" />
      {error ? (
        <div className="mt-6">
          <ErrorMessage message={error} />
        </div>
      ) : !loaded ? (
        <Loading />
      ) : (
        <PlayerList
          players={following}
          empty={
            <>
              You aren&rsquo;t following anyone yet.{" "}
              <Link href="/account/friends" className="link">
                Find friends
              </Link>{" "}
              to follow.
            </>
          }
        />
      )}
    </section>
  );
}
