export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-28" aria-busy="true">
      <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-ink-muted">
        Loading…
      </span>
    </main>
  );
}
