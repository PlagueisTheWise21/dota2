import { supabase } from "@/lib/supabase";

/** The columns the homepage needs from the `events` table. */
export type EventSummary = {
  /** uuid */
  id: string;
  name: string;
  image_url: string | null;
};

export type EventsResult = {
  events: EventSummary[];
  /** A message safe to show on the page, or null when the query worked. */
  error: string | null;
};

/**
 * Loads events for the homepage carousel.
 *
 * Supabase table: `events`
 * Columns read:   `id`, `name`, `image_url`
 * Ordered by:     `start_date` (earliest first)
 */
export async function getEvents(): Promise<EventsResult> {
  if (!supabase) {
    const supabaseKeyFound = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    );
    return {
      events: [],
      error:
        `Supabase is not configured (URL ${
          process.env.NEXT_PUBLIC_SUPABASE_URL ? "found" : "missing"
        }, key ${
          supabaseKeyFound ? "found" : "missing"
        }). Check the variable names in .env.local, then restart the dev server.`,
    };
  }

  const { data, error } = await supabase
    .from("events")
    .select("id, name, image_url")
    .order("start_date", { ascending: true });

  if (error) {
    console.error("Failed to load events:", error.message);
    return { events: [], error: "Events could not be loaded right now." };
  }

  return { events: (data ?? []) as EventSummary[], error: null };
}
