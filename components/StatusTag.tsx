import type { EventStatus } from "@/lib/event-status";

const TAGS: Record<EventStatus, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-[#ef4444]/15 text-[#fca5a5] ring-[#ef4444]/50" },
  upcoming: { label: "Upcoming", className: "bg-info/15 text-[#b5d4f4] ring-info/50" },
  finished: { label: "Finished", className: "bg-white/5 text-white/55 ring-white/15" },
};

/** "Live" (with a pulsing dot), "Upcoming" or "Finished" pill. */
export function StatusTag({ status }: { status: EventStatus }) {
  const { label, className } = TAGS[status];
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${className}`}>
      {status === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ef4444]" aria-hidden="true" />}
      {label}
    </span>
  );
}
