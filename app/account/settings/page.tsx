"use client";

import { BackgroundPicker, HobbiesForm, useAccount } from "@/components/Account";
import { SubPageHeader } from "@/components/Follows";

export default function SettingsPage() {
  const { signOut } = useAccount();
  return (
    <section className="animate-rise mx-auto max-w-xl">
      <SubPageHeader eyebrow="Account" title="Settings" />

      <div className="card mt-8 p-6">
        <h2 className="font-serif text-xl font-semibold">Your hobbies</h2>
        <p className="mt-1 text-sm text-stone-600">
          Your daily word rotates through these, one hobby a day.
        </p>
        <div className="mt-5">
          <HobbiesForm />
        </div>
      </div>

      <div className="card mt-6 p-6">
        <BackgroundPicker />
      </div>

      <button type="button" onClick={signOut} className="btn-secondary mt-8">
        Sign out
      </button>
    </section>
  );
}
