import { cache } from "react";
import type { BracketMatch, GroupFormat, GroupInfo, GroupRecord, PickemData } from "@/lib/pickems";
import { supabase } from "@/lib/supabase";

/**
 * Loads the pick'em data for one event (server side).
 *
 * Supabase tables: `matches`, `group_standings` (filled by `npm run sync`)
 * Columns read:    `matches.liquipedia_id, stage, bracket_section, round,
 *                  match_number, team1_id, team2_id, score1, score2, winner,
 *                  finished, starts_at, winner_to, winner_to_slot, loser_to,
 *                  loser_to_slot`;
 *                  `group_standings.team_id, round, wins, losses, placement,
 *                  status, group_index`
 *
 * `groupFormat` is `events.group_format` (set by the sync). Returns empty data
 * when the event has no Liquipedia data.
 */
export const getPickemData = cache(async (
  eventId: string,
  groupFormat: string | null,
): Promise<PickemData> => {
  const empty: PickemData = {
    groupFormat: null,
    groupTeamIds: [],
    groupRecords: null,
    groups: [],
    groupPlacements: null,
    bracket: [],
  };
  if (!supabase) return empty;

  const [matchesResult, standingsResult] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "liquipedia_id, stage, bracket_section, round, match_number, team1_id, team2_id, score1, score2, winner, finished, starts_at, winner_to, winner_to_slot, loser_to, loser_to_slot",
      )
      .eq("event_id", eventId),
    supabase
      .from("group_standings")
      .select("team_id, round, wins, losses, placement, status, group_index")
      .eq("event_id", eventId),
  ]);

  if (matchesResult.error || standingsResult.error) {
    console.error(
      "Failed to load pick'em data:",
      matchesResult.error?.message ?? standingsResult.error?.message,
    );
    return empty;
  }

  const rows = matchesResult.data ?? [];
  const standings = standingsResult.data ?? [];
  const groupMatches = rows.filter((row) => row.stage === "group");

  // Which group stage pick'em fits. Events synced before formats were
  // recorded have a group stage but no format: those were Swiss.
  const format: GroupFormat | null =
    groupMatches.length === 0
      ? null
      : groupFormat === "round_robin" || groupFormat === "gsl"
        ? "groups"
        : groupFormat === "swiss" || groupFormat === null
          ? "swiss"
          : "unsupported";

  // Round-robin and GSL groups, from the earliest round of the group tables.
  const groups: GroupInfo[] = [];
  let groupPlacements: Record<string, number> | null = null;
  if (format === "groups" && standings.length > 0) {
    const firstRound = Math.min(...standings.map((row) => row.round));
    const byGroup = new Map<number, typeof standings>();
    for (const row of standings.filter((r) => r.round === firstRound)) {
      byGroup.set(row.group_index, [...(byGroup.get(row.group_index) ?? []), row]);
    }
    for (const [index, groupRows] of [...byGroup].sort((a, b) => a[0] - b[0])) {
      groups.push({
        index,
        teamIds: groupRows.map((row) => row.team_id),
        // Liquipedia marks the places that go through as "up", and places
        // that play on in a later stage (e.g. a last chance bracket) as "stay".
        advance: groupRows.filter((row) => row.status === "up").length || Math.ceil(groupRows.length / 2),
        continues: groupRows.filter((row) => row.status === "stay").length,
      });
    }
    // Every match inside the groups is played. Matches between teams from
    // different groups (seeding or last chance games) don't count.
    const groupOf = new Map(groups.flatMap((group) => group.teamIds.map((id) => [id, group.index] as const)));
    const crossGroup = (row: { team1_id: string | null; team2_id: string | null }) =>
      Boolean(row.team1_id && row.team2_id) &&
      groupOf.has(row.team1_id!) &&
      groupOf.has(row.team2_id!) &&
      groupOf.get(row.team1_id!) !== groupOf.get(row.team2_id!);
    const allPlayed = groupMatches.filter((row) => !crossGroup(row)).every((row) => row.finished);
    if (allPlayed) {
      const lastRound = new Map<string, { round: number; placement: number | null }>();
      for (const row of standings) {
        const current = lastRound.get(row.team_id);
        if (!current || row.round > current.round) lastRound.set(row.team_id, row);
      }
      groupPlacements = Object.fromEntries(
        [...lastRound].filter(([, row]) => row.placement).map(([teamId, row]) => [teamId, row.placement!]),
      );
    }
  }

  // Group stage: every team that plays a group match (or is drawn into a group).
  const groupTeamIds = [
    ...new Set([
      ...groupMatches
        .flatMap((row) => [row.team1_id, row.team2_id])
        .filter((id): id is string => Boolean(id)),
      ...groups.flatMap((group) => group.teamIds),
    ]),
  ];

  // Final group records: each team's latest round, once all are decided
  // (Swiss: three wins or three losses).
  const latest = new Map<string, { round: number; wins: number; losses: number }>();
  for (const row of standings) {
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
      startsAt: row.starts_at,
      winnerTo: row.winner_to,
      winnerToSlot: slot(row.winner_to_slot),
      loserTo: row.loser_to,
      loserToSlot: slot(row.loser_to_slot),
    }));

  return {
    groupFormat: format,
    groupTeamIds,
    groupRecords: format === "swiss" && groupFinished ? records : null,
    groups,
    groupPlacements,
    bracket,
  };
});
