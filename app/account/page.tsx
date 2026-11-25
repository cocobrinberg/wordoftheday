"use client";

import { BackgroundPicker, useAccount } from "@/components/Account";

export default function AccountPage() {
  const { account, signOut } = useAccount();
  return (
    <section className="max-w-md">
      <p className="text-sm font-medium uppercase tracking-widest text-amber-700">Account</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{account.username}</h1>
      <div className="mt-8">
        <BackgroundPicker />
      </div>
      <button
        type="button"
        onClick={signOut}
        className="mt-10 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-900 hover:text-stone-50"
      >
        Sign out
      </button>
    </section>
  );
}
