import type { EventStatus } from "@/lib/event-status";

const STYLES: Record<EventStatus, { label: string; className: string }> = {
  live: { label: "Live", className: "border-[#ef4444] text-[#fca5a5]" },
  upcoming: { label: "Upcoming", className: "border-[#60a5fa]/70 text-[#bfdbfe]" },
  finished: { label: "Finished", className: "border-paper/30 text-paper/50" },
};

/** "Live" (with a pulsing dot), "Upcoming" or "Finished", in the site's boxy style. */
export function StatusTag({ status }: { status: EventStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border bg-panel px-2 py-0.5 font-display text-[clamp(0.65rem,1.6dvh,0.8rem)] font-bold tracking-widest uppercase ${className}`}
    >
      {status === "live" && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ef4444] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
        </span>
      )}
      {label}
    </span>
  );
}
