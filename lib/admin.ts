import { supabase } from "@/lib/supabase";

/**
 * Reading and changing events and teams from the admin page (browser).
 *
 * Writes go through the signed-in admin's own session; the database allows
 * them only for people in `public.admins` (supabase/migrations/20261010_admin.sql).
 * Tables: events, teams, event_teams; Storage buckets team-logos and event-banners.
 */

export type AdminEvent = {
  id: string;
  name: string;
  slug: string;
  start_date: string;
  end_date: string;
  /** When group stage picks lock. */
  prediction_deadline: string;
  /** Overrides when playoff picks lock; null = automatic. */
  playoff_deadline: string | null;
  status: string;
  image_url: string | null;
  liquipedia_page: string | null;
  group_format: string | null;
  /** Re-sync from Liquipedia automatically while the event is live. */
  auto_sync: boolean;
  /** When the sync last wrote this event (manual or automatic). */
  last_synced_at: string | null;
};

export type AdminTeam = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  liquipedia_template: string | null;
};

export type EventTeamLink = { event_id: string; team_id: string; seed: number | null };

export type AdminData = {
  events: AdminEvent[];
  teams: AdminTeam[];
  eventTeams: EventTeamLink[];
};

/** Data from the last sync and the automatic playoff deadline, for one event. */
export type EventSyncInfo = {
  /** Newest `matches.updated_at`, i.e. the last time the sync wrote this event. */
  lastSynced: string | null;
  /** First playoff match start (the automatic playoff deadline). */
  firstPlayoffMatch: string | null;
};

const EVENT_COLUMNS =
  "id, name, slug, start_date, end_date, prediction_deadline, playoff_deadline, status, image_url, liquipedia_page, group_format, auto_sync, last_synced_at";
const TEAM_COLUMNS = "id, name, short_name, logo_url, liquipedia_template";

function db() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

/** True when the signed-in person is an admin (false before the SQL is run). */
export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await db().rpc("is_admin");
  return !error && data === true;
}

export async function loadAdminData(): Promise<AdminData> {
  const [events, teams, eventTeams] = await Promise.all([
    db().from("events").select(EVENT_COLUMNS).order("start_date", { ascending: false }),
    db().from("teams").select(TEAM_COLUMNS).order("name"),
    db().from("event_teams").select("event_id, team_id, seed"),
  ]);
  return {
    events: check(events) as AdminEvent[],
    teams: check(teams) as AdminTeam[],
    eventTeams: check(eventTeams) as EventTeamLink[],
  };
}

export async function loadEventSyncInfo(eventId: string): Promise<EventSyncInfo> {
  const [latest, firstPlayoff] = await Promise.all([
    db()
      .from("matches")
      .select("updated_at")
      .eq("event_id", eventId)
      .order("updated_at", { ascending: false })
      .limit(1),
    db()
      .from("matches")
      .select("starts_at")
      .eq("event_id", eventId)
      .eq("stage", "playoffs")
      .not("starts_at", "is", null)
      .order("starts_at")
      .limit(1),
  ]);
  return {
    lastSynced: (check(latest) as { updated_at: string }[])[0]?.updated_at ?? null,
    firstPlayoffMatch: (check(firstPlayoff) as { starts_at: string }[])[0]?.starts_at ?? null,
  };
}

// --- Events -------------------------------------------------------------------

export type EventInput = Omit<AdminEvent, "id" | "last_synced_at">;

/** Creates the event (no id) or saves changes to it; returns the saved row. */
export async function saveEvent(id: string | null, input: EventInput): Promise<AdminEvent> {
  const query = id
    ? db().from("events").update(input).eq("id", id)
    : db().from("events").insert(input);
  return check(await query.select(EVENT_COLUMNS).single()) as AdminEvent;
}

/** Changes a few columns, e.g. a deadline. */
export async function updateEvent(id: string, changes: Partial<EventInput>): Promise<AdminEvent> {
  return check(
    await db().from("events").update(changes).eq("id", id).select(EVENT_COLUMNS).single(),
  ) as AdminEvent;
}

/**
 * Deletes the event. Its matches, group tables, placements and everyone's
 * saved tier lists and pick'ems for it go too (cascade).
 */
export async function deleteEvent(id: string) {
  check(await db().from("event_teams").delete().eq("event_id", id));
  check(await db().from("events").delete().eq("id", id));
}

/**
 * Makes the event's team list exactly `teamIds`, seeded in that order
 * (first = seed 1).
 */
export async function saveEventTeams(eventId: string, teamIds: string[], previousIds: string[]) {
  const removed = previousIds.filter((id) => !teamIds.includes(id));
  if (removed.length) {
    check(await db().from("event_teams").delete().eq("event_id", eventId).in("team_id", removed));
  }
  if (teamIds.length) {
    const rows = teamIds.map((teamId, index) => ({ event_id: eventId, team_id: teamId, seed: index + 1 }));
    check(await db().from("event_teams").upsert(rows, { onConflict: "event_id,team_id" }));
  }
}

// --- Teams --------------------------------------------------------------------

export type TeamInput = Pick<AdminTeam, "name" | "short_name" | "logo_url">;

export async function saveTeam(id: string | null, input: TeamInput): Promise<AdminTeam> {
  const query = id
    ? db().from("teams").update(input).eq("id", id)
    : db().from("teams").insert(input);
  return check(await query.select(TEAM_COLUMNS).single()) as AdminTeam;
}

/** Fails if the team has match or group data; merge it into another team instead. */
export async function deleteTeam(id: string) {
  const counts = await Promise.all([
    db().from("matches").select("id", { count: "exact", head: true }).or(`team1_id.eq.${id},team2_id.eq.${id}`),
    db().from("group_standings").select("id", { count: "exact", head: true }).eq("team_id", id),
    db().from("event_placements").select("id", { count: "exact", head: true }).eq("team_id", id),
  ]);
  for (const { count, error } of counts) {
    if (error) throw new Error(error.message);
    if (count) throw new Error("This team has match or group results. Merge it into another team instead.");
  }
  check(await db().from("event_teams").delete().eq("team_id", id));
  check(await db().from("teams").delete().eq("id", id));
}

/** Moves everything from `removeId` to `keepId`, then deletes `removeId`. */
export async function mergeTeams(keepId: string, removeId: string) {
  check(await db().rpc("merge_teams", { p_keep: keepId, p_remove: removeId }));
}

// --- Images -------------------------------------------------------------------

export type ImageBucket = "team-logos" | "event-banners";

/** Uploads an image under a new name and returns its public URL. */
export async function uploadImage(bucket: ImageBucket, baseName: string, image: Blob): Promise<string> {
  const extension = image.type === "image/webp" ? "webp" : image.type === "image/jpeg" ? "jpg" : "png";
  // A new name every time, so browsers never show an old cached copy.
  const path = `${slugify(baseName) || "image"}-${Date.now().toString(36)}.${extension}`;
  check(
    await db().storage.from(bucket).upload(path, image, {
      contentType: image.type,
      cacheControl: "31536000",
    }),
  );
  return db().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Deletes a file this site uploaded, if `url` points at one. Never throws. */
export async function removeOwnImage(bucket: ImageBucket, url: string | null) {
  if (!url) return;
  const prefix = db().storage.from(bucket).getPublicUrl("").data.publicUrl;
  if (!url.startsWith(prefix)) return;
  const path = decodeURIComponent(url.slice(prefix.length).replace(/^\//, ""));
  if (path) await db().storage.from(bucket).remove([path]).catch(() => undefined);
}

/** True when the URL is a file in one of this site's Storage buckets. */
export function isOwnImage(bucket: ImageBucket, url: string | null): boolean {
  if (!url || !supabase) return false;
  return url.startsWith(supabase.storage.from(bucket).getPublicUrl("").data.publicUrl);
}

// --- Public page cache -----------------------------------------------------------

/**
 * Clears the cached homepage and event pages (app/api/revalidate/route.ts) so
 * a change shows on the site straight away. Never throws.
 */
export async function refreshPublicPages() {
  try {
    const { data } = await db().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/revalidate", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // The pages refresh on their own within a minute anyway.
  }
}

// --- Liquipedia sync ------------------------------------------------------------

export type SyncResult = {
  ok: boolean;
  error?: string;
  log: string[];
  eventId?: string | null;
  createdTeams?: string[];
};

/** Runs the Liquipedia sync on the server (app/api/admin/sync/route.ts). */
export async function runSync(page: string, eventId: string | null, dryRun: boolean): Promise<SyncResult> {
  const { data } = await db().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Sign in first.", log: [] };
  const response = await fetch("/api/admin/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ page, eventId, dryRun }),
  });
  try {
    return (await response.json()) as SyncResult;
  } catch {
    return { ok: false, error: `The server answered ${response.status}.`, log: [] };
  }
}

// --- Helpers --------------------------------------------------------------------

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
