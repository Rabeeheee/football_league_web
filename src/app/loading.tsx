export default function Loading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400"
        aria-hidden
      />
      <p className="text-sm text-white/45">Loading…</p>
    </div>
  );
}
