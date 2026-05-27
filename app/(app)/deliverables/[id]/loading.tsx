export default function Loading() {
  return (
    <div className="flex-1 flex">
      <div className="flex-1 bg-bg-muted animate-pulse" />
      <aside className="w-[380px] shrink-0 border-l border-border-card bg-bg p-5 space-y-3">
        <div className="h-4 w-1/3 rounded bg-bg-muted animate-pulse" />
        <div className="h-12 w-full rounded-xl bg-bg-muted animate-pulse" />
        <div className="h-24 w-full rounded-xl bg-bg-muted animate-pulse" />
        <div className="h-24 w-full rounded-xl bg-bg-muted animate-pulse" />
      </aside>
    </div>
  );
}
