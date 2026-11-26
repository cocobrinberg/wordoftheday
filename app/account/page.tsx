"use client";

import { BackgroundPicker, HobbiesForm, useAccount } from "@/components/Account";

export default function AccountPage() {
  const { account, signOut } = useAccount();
  return (
    <section className="animate-rise mx-auto max-w-xl">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-orange-400 to-orange-600 font-serif text-3xl font-bold text-white uppercase shadow-[0_4px_0_0_var(--color-orange-700)]"
        >
          {account.username[0]}
        </span>
        <div className="min-w-0">
          <p className="eyebrow text-accent">Account</p>
          <h1 className="mt-1 truncate font-serif text-4xl font-semibold tracking-tight">
            {account.username}
          </h1>
        </div>
      </div>

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
