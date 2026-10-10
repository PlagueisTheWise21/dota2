/**
 * Whether an event is upcoming, live or finished, worked out from its dates
 * (`events.start_date`, `events.end_date`), so it is always current. The
 * free-text `events.status` column is no longer shown on the site.
 */
export type EventStatus = "upcoming" | "live" | "finished";

export function eventStatus(startDate: string, endDate: string, now = Date.now()): EventStatus {
  if (now < Date.parse(startDate)) return "upcoming";
  if (now <= Date.parse(endDate)) return "live";
  return "finished";
}

const ORDER: Record<EventStatus, number> = { live: 0, upcoming: 1, finished: 2 };

/**
 * Homepage order: live events first (newest first), then upcoming (soonest
 * first), then finished (most recently ended first).
 */
export function compareEvents(
  a: { status: EventStatus; start_date: string; end_date: string },
  b: { status: EventStatus; start_date: string; end_date: string },
): number {
  if (a.status !== b.status) return ORDER[a.status] - ORDER[b.status];
  if (a.status === "upcoming") return Date.parse(a.start_date) - Date.parse(b.start_date);
  if (a.status === "finished") return Date.parse(b.end_date) - Date.parse(a.end_date);
  return Date.parse(b.start_date) - Date.parse(a.start_date);
}
