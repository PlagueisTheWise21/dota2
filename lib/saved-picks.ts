import type { Slots } from "@/components/SlotBoard";
import type { Placements } from "@/components/TierList";
import type { BracketPicks } from "@/lib/pickems";
import { supabase } from "@/lib/supabase";

/**
 * Loading and saving a signed-in person's tier list and pick'ems (browser).
 *
 * Supabase tables (see supabase/migrations/20261009_accounts.sql):
 *   saved_tier_lists  user_id, event_id, placements (jsonb)
 *   saved_pickems     user_id, event_id, stage ('group' | 'playoffs'), picks (jsonb)
 * Row level security lets people read and change only their own rows, and
 * refuses pick'em changes after the stage's deadline.
 */

export type SavedPickems = { group: Slots | null; playoffs: BracketPicks | null };

/**
 * Runs a save; if it fails because the person has no profile yet (Postgres
 * foreign key error 23503), creates the profile and tries once more.
 */
async function withProfile(save: () => PromiseLike<{ error: { code?: string; message: string } | null }>) {
  if (!supabase) throw new Error("Supabase is not configured");
  let { error } = await save();
  if (error?.code === "23503") {
    const created = await supabase.rpc("ensure_profile");
    if (created.error) throw new Error(created.error.message);
    ({ error } = await save());
  }
  if (error) throw new Error(error.message);
}

export async function loadTierList(userId: string, eventId: string): Promise<Placements | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("saved_tier_lists")
    .select("placements")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.placements as Placements | undefined) ?? null;
}

export async function saveTierList(userId: string, eventId: string, placements: Placements) {
  await withProfile(() =>
    supabase!
      .from("saved_tier_lists")
      .upsert({ user_id: userId, event_id: eventId, placements }, { onConflict: "user_id,event_id" }),
  );
}

export async function loadPickems(userId: string, eventId: string): Promise<SavedPickems> {
  const result: SavedPickems = { group: null, playoffs: null };
  if (!supabase) return result;
  const { data, error } = await supabase
    .from("saved_pickems")
    .select("stage, picks")
    .eq("user_id", userId)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    if (row.stage === "group") result.group = row.picks as Slots;
    if (row.stage === "playoffs") result.playoffs = row.picks as BracketPicks;
  }
  return result;
}

export async function savePickems(
  userId: string,
  eventId: string,
  stage: "group" | "playoffs",
  picks: Slots | BracketPicks,
) {
  await withProfile(() =>
    supabase!
      .from("saved_pickems")
      .upsert(
        { user_id: userId, event_id: eventId, stage, picks },
        { onConflict: "user_id,event_id,stage" },
      ),
  );
}

/**
 * A saved tier list checked against the event's current teams: unknown ids
 * are dropped and teams missing from it go to Unranked.
 */
export function cleanTierList(saved: Placements, teamIds: string[]): Placements {
  const known = new Set(teamIds);
  const seen = new Set<string>();
  const cleaned = Object.fromEntries(
    Object.entries(saved).map(([tier, ids]) => [
      tier,
      (Array.isArray(ids) ? ids : []).filter((id) => {
        if (!known.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      }),
    ]),
  ) as Placements;
  for (const tier of ["S", "A", "B", "C", "F", "unranked"] as const) cleaned[tier] ??= [];
  cleaned.unranked.push(...teamIds.filter((id) => !seen.has(id)));
  return cleaned;
}

/**
 * Saved group picks checked against the current groups: each block of slots
 * (one for Swiss, one per round-robin group) only keeps that block's teams.
 */
export function cleanGroupPicks(
  saved: Slots,
  segments: { offset: number; size: number; teamIds: string[] }[],
): Slots {
  const seen = new Set<string>();
  return segments.flatMap((segment) => {
    const known = new Set(segment.teamIds);
    return Array.from({ length: segment.size }, (_, index) => {
      const id = Array.isArray(saved) ? saved[segment.offset + index] : null;
      if (!id || !known.has(id) || seen.has(id)) return null;
      seen.add(id);
      return id;
    });
  });
}
