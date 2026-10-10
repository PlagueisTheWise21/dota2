/**
 * Full-screen loading state shown the moment someone opens a page that
 * still has to load (app/loading.tsx, app/events/[id]/loading.tsx).
 * The site background stays visible behind it.
 */
export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <main className="flex h-dvh w-full flex-col items-center justify-center gap-4" aria-busy="true">
      <span
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-accent/25 border-t-accent"
        aria-hidden="true"
      />
      <p role="status" className="text-sm font-semibold tracking-[0.2em] text-muted uppercase">
        {label}…
      </p>
    </main>
  );
}
