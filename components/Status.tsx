export function Loading() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-stone-500" role="status">
      <span className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 animate-bounce rounded-full bg-stone-400"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
      <span className="text-sm">Loading…</span>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="alert-error flex gap-3 p-4 text-base" role="alert">
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-full bg-rose-200 text-sm font-bold text-rose-800"
      >
        !
      </span>
      <p>
        <span className="font-semibold">Something went wrong.</span> {message}
      </p>
    </div>
  );
}
