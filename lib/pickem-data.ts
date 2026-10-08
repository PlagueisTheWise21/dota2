import { cache } from "react";
import type { BracketMatch, GroupRecord, PickemData } from "@/lib/pickems";
import { supabase } from "@/lib/supabase";

/**
 * Loads the pick'em data for one event (server side).
 *
 * Supabase tables: `matches`, `group_standings` (filled by `npm run sync`)
 * Columns read:    `matches.liquipedia_id, stage, bracket_section, round,
 *                  match_number, team1_id, team2_id, score1, score2, winner,
 *                  finished, winner_to, winner_to_slot, loser_to, loser_to_slot`;
 *                  `group_standings.team_id, round, wins, losses`
 *
 * Returns empty data when the event has no Liquipedia data.
 */
export const getPickemData = cache(async (eventId: string): Promise<PickemData> => {
  const empty: PickemData = { groupTeamIds: [], groupRecords: null, bracket: [] };
  if (!supabase) return empty;

  const [matchesResult, standingsResult] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "liquipedia_id, stage, bracket_section, round, match_number, team1_id, team2_id, score1, score2, winner, finished, winner_to, winner_to_slot, loser_to, loser_to_slot",
      )
      .eq("event_id", eventId),
    supabase.from("group_standings").select("team_id, round, wins, losses").eq("event_id", eventId),
  ]);

  if (matchesResult.error || standingsResult.error) {
    console.error(
      "Failed to load pick'em data:",
      matchesResult.error?.message ?? standingsResult.error?.message,
    );
    return empty;
  }

  const rows = matchesResult.data ?? [];

  // Group stage: every team that plays a group match.
  const groupTeamIds = [
    ...new Set(
      rows
        .filter((row) => row.stage === "group")
        .flatMap((row) => [row.team1_id, row.team2_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  // Final group records: each team's latest round, once all are decided
  // (Swiss: three wins or three losses).
  const latest = new Map<string, { round: number; wins: number; losses: number }>();
  for (const row of standingsResult.data ?? []) {
    const current = latest.get(row.team_id);
    if (!current || row.round > current.round) latest.set(row.team_id, row);
  }
  const records: GroupRecord[] = groupTeamIds
    .map((teamId) => latest.get(teamId) && { teamId, ...latest.get(teamId)! })
    .filter((record): record is GroupRecord & { round: number } => Boolean(record))
    .map(({ teamId, wins, losses }) => ({ teamId, wins, losses }));
  const groupFinished =
    groupTeamIds.length > 0 &&
    records.length === groupTeamIds.length &&
    records.every((record) => record.wins >= 3 || record.losses >= 3);

  const slot = (value: number | null) => (value === 1 || value === 2 ? value : null);
  const bracket: BracketMatch[] = rows
    .filter((row) => row.stage === "playoffs")
    .map((row) => ({
      id: row.liquipedia_id,
      section: row.bracket_section === "lower" ? "lower" : "upper",
      round: row.round,
      number: row.match_number,
      team1: row.team1_id,
      team2: row.team2_id,
      winner: slot(row.winner),
      score1: row.score1,
      score2: row.score2,
      finished: row.finished,
      winnerTo: row.winner_to,
      winnerToSlot: slot(row.winner_to_slot),
      loserTo: row.loser_to,
      loserToSlot: slot(row.loser_to_slot),
    }));

  return { groupTeamIds, groupRecords: groupFinished ? records : null, bracket };
});
