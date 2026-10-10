import type { Slots } from "@/components/SlotBoard";
import {
  grandFinal,
  groupSegments,
  groupIndexOfSlot,
  realWinner,
  resolveBracket,
  swissGroups,
  swissPickCorrect,
  type BracketMatch,
  type BracketPicks,
  type PickemData,
} from "@/lib/pickems";
import { cleanGroupPicks } from "@/lib/saved-picks";
import { supabase } from "@/lib/supabase";

/**
 * Pick'em leaderboard: everyone's saved picks scored against the real
 * results. A pick scores exactly when the pick'em shows it with a ✓.
 *
 * Supabase tables: `saved_pickems` (user_id, stage, picks) with
 * `profiles` (display_name, avatar_url). Row level security only shows a
 * stage's picks once its deadline has passed, so nobody can copy picks
 * early; the leaderboard fills in at each deadline.
 */

/** Points per correct pick. Change here to weight the stages differently. */
export const POINTS = {
  /** Swiss: a team in the right box (3–0, advance, 0–3). Groups (round-robin/GSL): a team in its exact place. */
  group: 1,
  /** A correctly picked playoff match winner (including the grand final). */
  playoffMatch: 1,
};

export type LeaderboardEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Points from the group stage, or null without saved group picks. */
  group: number | null;
  /** Points from the playoffs, or null without saved playoff picks. */
  playoffs: number | null;
  total: number;
  /** Team id picked to win the grand final. */
  champion: string | null;
  /** 1 = first; equal totals share a rank. */
  rank: number;
};

export type Leaderboard = {
  entries: LeaderboardEntry[];
  /** True once any group result or playoff match counts for points. */
  scoring: boolean;
};

/** Points for one person's group picks; 0 until the final group results are in. */
export function scoreGroup(data: PickemData, slots: Slots): number {
  if (data.groupFormat === "swiss" && data.groupRecords) {
    const groups = swissGroups(data.groupTeamIds.length);
    const records = new Map(data.groupRecords.map((record) => [record.teamId, record]));
    return slots.filter((teamId, index) => {
      const record = teamId ? records.get(teamId) : undefined;
      return record ? swissPickCorrect(groupIndexOfSlot(groups, index), record) : false;
    }).length * POINTS.group;
  }
  if (data.groupFormat === "groups" && data.groupPlacements) {
    const placements = data.groupPlacements;
    return groupSegments(data).reduce((sum, segment) => {
      const groupSlots = slots.slice(segment.offset, segment.offset + segment.size);
      return sum + groupSlots.filter((id, index) => id && placements[id] === index + 1).length;
    }, 0) * POINTS.group;
  }
  return 0;
}

/** Points for one person's playoff picks, from the matches played so far. */
export function scorePlayoffs(bracket: BracketMatch[], picks: BracketPicks): number {
  const { resolved } = resolveBracket(bracket, picks);
  return [...resolved.values()].filter((r) => r.pick && r.pick === realWinner(r.match)).length * POINTS.playoffMatch;
}

type SavedRow = {
  user_id: string;
  stage: "group" | "playoffs";
  picks: unknown;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

/** The event's leaderboard (server side). Empty before the group deadline. */
export async function getLeaderboard(eventId: string, data: PickemData): Promise<Leaderboard> {
  const scoring =
    Boolean(data.groupRecords || data.groupPlacements) || data.bracket.some((match) => realWinner(match));
  if (!supabase) return { entries: [], scoring };

  const { data: rows, error } = await supabase
    .from("saved_pickems")
    .select("user_id, stage, picks, profiles(display_name, avatar_url)")
    .eq("event_id", eventId);
  if (error) {
    console.error("Failed to load the leaderboard:", error.message);
    return { entries: [], scoring };
  }

  const segments = groupSegments(data);
  const final = grandFinal(data.bracket);
  const byUser = new Map<string, Omit<LeaderboardEntry, "total" | "rank">>();
  for (const row of (rows ?? []) as unknown as SavedRow[]) {
    const entry = byUser.get(row.user_id) ?? {
      userId: row.user_id,
      name: row.profiles?.display_name ?? "Player",
      avatarUrl: row.profiles?.avatar_url ?? null,
      group: null,
      playoffs: null,
      champion: null,
    };
    if (row.stage === "group" && Array.isArray(row.picks) && segments.length > 0) {
      // Same clean-up as when the picks load on the event page.
      const slots = cleanGroupPicks(row.picks as Slots, segments);
      if (slots.some(Boolean)) entry.group = scoreGroup(data, slots);
    }
    if (row.stage === "playoffs" && row.picks && typeof row.picks === "object" && data.bracket.length > 0) {
      const picks = resolveBracket(data.bracket, row.picks as BracketPicks).picks;
      if (Object.keys(picks).length > 0) {
        entry.playoffs = scorePlayoffs(data.bracket, picks);
        entry.champion = final ? (picks[final.id] ?? null) : null;
      }
    }
    byUser.set(row.user_id, entry);
  }

  const sorted = [...byUser.values()]
    .filter((entry) => entry.group !== null || entry.playoffs !== null)
    .map((entry) => ({ ...entry, total: (entry.group ?? 0) + (entry.playoffs ?? 0) }))
    .sort((a, b) => b.total - a.total || (b.playoffs ?? 0) - (a.playoffs ?? 0) || a.name.localeCompare(b.name));

  let rank = 0;
  const entries = sorted.map((entry, index) => {
    if (index === 0 || entry.total !== sorted[index - 1].total) rank = index + 1;
    return { ...entry, rank };
  });
  return { entries, scoring };
}
