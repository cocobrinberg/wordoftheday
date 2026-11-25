export function Loading() {
  return <p className="py-16 text-center text-stone-500">Loading…</p>;
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      Something went wrong: {message}
    </p>
  );
}
