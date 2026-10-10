import { cache } from "react";
import { compareEvents, eventStatus, type EventStatus } from "@/lib/event-status";
import { supabase } from "@/lib/supabase";

/** The columns the homepage needs from the `events` table. */
export type EventSummary = {
  /** uuid */
  id: string;
  name: string;
  image_url: string | null;
  start_date: string;
  end_date: string;
  /** From the dates (lib/event-status.ts), not the `status` column. */
  status: EventStatus;
};

export type EventsResult = {
  events: EventSummary[];
  /** A message safe to show on the page, or null when the query worked. */
  error: string | null;
};

/** A team taking part in an event (from `teams`, via `event_teams`). */
export type EventTeam = {
  /** uuid */
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};

/** Everything the event page needs. */
export type EventDetails = {
  /** uuid */
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  prediction_deadline: string;
  /** Set by an admin to lock playoff picks at another time; null = automatic. */
  playoff_deadline: string | null;
  /** Upcoming / live / finished, from the dates (lib/event-status.ts). */
  status: EventStatus;
  /** e.g. "PGL/Wallachia/9"; null when not linked to Liquipedia. */
  liquipedia_page: string | null;
  /** 'swiss', 'round_robin', 'gsl', 'other' (set by the sync), or null. */
  group_format: string | null;
  /** Ordered by `event_teams.seed`, unseeded teams last by name. */
  teams: EventTeam[];
};

export type EventResult = {
  /** null with a null error means the event does not exist. */
  event: EventDetails | null;
  /** A message safe to show on the page, or null when the query worked. */
  error: string | null;
};

/** Shape of the nested Supabase response in getEvent. */
type EventRow = Omit<EventDetails, "teams" | "status"> & {
  event_teams: { seed: number | null; teams: EventTeam | null }[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notConfiguredMessage(): string {
  const supabaseKeyFound = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  );
  return `Supabase is not configured (URL ${
    process.env.NEXT_PUBLIC_SUPABASE_URL ? "found" : "missing"
  }, key ${
    supabaseKeyFound ? "found" : "missing"
  }). Check the variable names in .env.local, then restart the dev server.`;
}

/**
 * Loads events for the homepage carousel.
 *
 * Supabase table: `events`
 * Columns read:   `id`, `name`, `image_url`, `start_date`, `end_date`
 * Ordered by:     live first (newest first), then upcoming (soonest first),
 *                 then finished (most recently ended first)
 */
export async function getEvents(): Promise<EventsResult> {
  if (!supabase) {
    return { events: [], error: notConfiguredMessage() };
  }

  const { data, error } = await supabase
    .from("events")
    .select("id, name, image_url, start_date, end_date");

  if (error) {
    console.error("Failed to load events:", error.message);
    return { events: [], error: "Events could not be loaded right now." };
  }

  const now = Date.now();
  const events = (data ?? [])
    .map((row) => ({ ...row, status: eventStatus(row.start_date, row.end_date, now) }))
    .sort(compareEvents) as EventSummary[];
  return { events, error: null };
}

/**
 * Loads one event and its participating teams for the event page.
 *
 * Supabase tables: `events`, `event_teams`, `teams`
 * Columns read:    `events.id, name, start_date, end_date, prediction_deadline, playoff_deadline, liquipedia_page, group_format`,
 *                  `event_teams.seed`,
 *                  `teams.id, name, short_name, logo_url`
 *
 * Wrapped in React `cache` so the page and its metadata share one query.
 */
export const getEvent = cache(async (id: string): Promise<EventResult> => {
  // Not a uuid, so it cannot match an event (and Postgres would reject it).
  if (!UUID_PATTERN.test(id)) {
    return { event: null, error: null };
  }

  if (!supabase) {
    return { event: null, error: notConfiguredMessage() };
  }

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, name, start_date, end_date, prediction_deadline, playoff_deadline, liquipedia_page, group_format, event_teams(seed, teams(id, name, short_name, logo_url))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load event:", error.message);
    return { event: null, error: "This event could not be loaded right now." };
  }

  if (!data) {
    return { event: null, error: null };
  }

  const row = data as unknown as EventRow;
  const teams = row.event_teams
    .filter((entry) => entry.teams !== null)
    .sort(
      (a, b) =>
        (a.seed ?? Infinity) - (b.seed ?? Infinity) ||
        a.teams!.name.localeCompare(b.teams!.name),
    )
    .map((entry) => entry.teams as EventTeam);

  return {
    event: {
      id: row.id,
      name: row.name,
      start_date: row.start_date,
      end_date: row.end_date,
      prediction_deadline: row.prediction_deadline,
      playoff_deadline: row.playoff_deadline,
      status: eventStatus(row.start_date, row.end_date),
      liquipedia_page: row.liquipedia_page,
      group_format: row.group_format,
      teams,
    },
    error: null,
  };
});
