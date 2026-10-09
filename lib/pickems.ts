import type { SlotGroup } from "@/components/SlotBoard";

/**
 * Pick'em data shapes and logic (no React, no database). The data comes
 * from lib/pickem-data.ts, which reads what `npm run sync` copied from
 * Liquipedia into `matches` and `group_standings`.
 */

/** One playoff match. Ids are Liquipedia match ids (`matches.liquipedia_id`). */
export type BracketMatch = {
  id: string;
  section: "upper" | "lower";
  round: number;
  number: number;
  /** Real teams; for slots fed by another match these are ignored for picks. */
  team1: string | null;
  team2: string | null;
  /** Real winner: 1, 2 or null while unplayed. */
  winner: 1 | 2 | null;
  score1: number | null;
  score2: number | null;
  finished: boolean;
  /** ISO time, or null when not scheduled yet. */
  startsAt: string | null;
  winnerTo: string | null;
  winnerToSlot: 1 | 2 | null;
  loserTo: string | null;
  loserToSlot: 1 | 2 | null;
};

/** A team's final group stage record. */
export type GroupRecord = { teamId: string; wins: number; losses: number };

/** One round-robin group: its teams and how many of them advance. */
export type GroupInfo = { index: number; teamIds: string[]; advance: number };

export type GroupFormat = "swiss" | "round_robin" | "unsupported";

export type PickemData = {
  /** Which group stage pick'em to show; null when there is no group stage. */
  groupFormat: GroupFormat | null;
  /** Teams playing the group stage (all groups); empty until known. */
  groupTeamIds: string[];
  /** Swiss: final records, only once every team has finished. */
  groupRecords: GroupRecord[] | null;
  /** Round-robin: the groups, empty until they have been drawn. */
  groups: GroupInfo[];
  /** Round-robin: each team's final place in its group, once all group matches are played. */
  groupPlacements: Record<string, number> | null;
  /** Playoff matches; empty when there is no bracket. */
  bracket: BracketMatch[];
};

// --- Group stage (Swiss) ------------------------------------------------------

/**
 * CS-major style Swiss pick'em: which teams go 3-0, which advance with
 * 3-1/3-2, which go 0-3. For 16 teams: 2, 6 and 2 picks (half the teams
 * advance; one in eight go 3-0, and as many go 0-3).
 */
export function swissGroups(teamCount: number): SlotGroup[] {
  const perfect = Math.max(1, Math.round(teamCount / 8));
  const advancing = Math.floor(teamCount / 2);
  return [
    { label: "3–0", sublabel: "undefeated", size: perfect, color: "#22c55e" },
    { label: "Advance", sublabel: "3–1 / 3–2", size: Math.max(0, advancing - perfect) },
    { label: "0–3", sublabel: "winless", size: perfect, color: "#ef4444" },
  ];
}

/**
 * Round-robin pick'em for one group: order its teams 1st to last. The top
 * `advance` places go through; the rest are out.
 */
export function roundRobinGroups(size: number, advance: number): SlotGroup[] {
  return Array.from({ length: size }, (_, index) => ({
    label: ordinal(index + 1),
    sublabel: index < advance ? "advance" : "out",
    size: 1,
    color: index < advance ? undefined : "#ef4444",
  }));
}

/** "Group A", "Group B"... */
export function groupName(index: number): string {
  return `Group ${String.fromCharCode(65 + index)}`;
}

function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

/**
 * How the saved group picks array is split up: Swiss is one block of slots
 * (3-0, advance, 0-3); round-robin has one block per group (1st..last).
 */
export function groupSegments(data: PickemData): { offset: number; size: number; teamIds: string[] }[] {
  if (data.groupFormat === "swiss") {
    const size = swissGroups(data.groupTeamIds.length).reduce((sum, group) => sum + group.size, 0);
    return data.groupTeamIds.length > 0 ? [{ offset: 0, size, teamIds: data.groupTeamIds }] : [];
  }
  if (data.groupFormat === "round_robin") {
    let offset = 0;
    return data.groups.map((group) => {
      const segment = { offset, size: group.teamIds.length, teamIds: group.teamIds };
      offset += group.teamIds.length;
      return segment;
    });
  }
  return [];
}

/** Total number of group pick slots. */
export function groupSlotCount(data: PickemData): number {
  return groupSegments(data).reduce((sum, segment) => sum + segment.size, 0);
}

/** Whether a pick in the given group came true, from the team's final record. */
export function swissPickCorrect(groupIndex: number, record: GroupRecord): boolean {
  if (groupIndex === 0) return record.wins === 3 && record.losses === 0;
  if (groupIndex === 1) return record.wins === 3 && record.losses > 0;
  return record.wins === 0 && record.losses === 3;
}

/** Which group a slot index belongs to. */
export function groupIndexOfSlot(groups: SlotGroup[], slotIndex: number): number {
  let end = 0;
  for (let index = 0; index < groups.length; index++) {
    end += groups[index].size;
    if (slotIndex < end) return index;
  }
  return groups.length - 1;
}

// --- Playoffs -----------------------------------------------------------------

/** Picked winner (team id) for each match id. */
export type BracketPicks = Record<string, string>;

export type ResolvedMatch = {
  match: BracketMatch;
  /** Teams in this match according to your picks (null = not decided yet). */
  teams: [string | null, string | null];
  pick: string | null;
};

/** Matches in play order: by round, upper bracket before lower in a round. */
export function playOrder(matches: BracketMatch[]): BracketMatch[] {
  return [...matches].sort(
    (a, b) =>
      a.round - b.round ||
      (a.section === b.section ? 0 : a.section === "upper" ? -1 : 1) ||
      a.number - b.number,
  );
}

/**
 * Works out every match's teams from your picks, and drops picks that are no
 * longer possible (e.g. you changed an earlier winner). Slots that no other
 * match feeds (the first round) use the real teams.
 */
export function resolveBracket(
  matches: BracketMatch[],
  picks: BracketPicks,
): { resolved: Map<string, ResolvedMatch>; picks: BracketPicks } {
  // Which match feeds each slot, and with its winner or loser.
  const feeds = new Map<string, { from: string; kind: "winner" | "loser" }>();
  for (const match of matches) {
    if (match.winnerTo && match.winnerToSlot) {
      feeds.set(`${match.winnerTo}:${match.winnerToSlot}`, { from: match.id, kind: "winner" });
    }
    if (match.loserTo && match.loserToSlot) {
      feeds.set(`${match.loserTo}:${match.loserToSlot}`, { from: match.id, kind: "loser" });
    }
  }

  const resolved = new Map<string, ResolvedMatch>();
  const kept: BracketPicks = {};

  const outcome = (fromId: string, kind: "winner" | "loser"): string | null => {
    const from = resolved.get(fromId);
    if (!from?.pick) return null;
    if (kind === "winner") return from.pick;
    return from.teams.find((team) => team && team !== from.pick) ?? null;
  };

  for (const match of playOrder(matches)) {
    const teams = ([1, 2] as const).map((slot) => {
      const feed = feeds.get(`${match.id}:${slot}`);
      if (feed) return outcome(feed.from, feed.kind);
      return slot === 1 ? match.team1 : match.team2;
    }) as [string | null, string | null];

    const wanted = picks[match.id];
    const pick = wanted && teams.includes(wanted) ? wanted : null;
    if (pick) kept[match.id] = pick;
    resolved.set(match.id, { match, teams, pick });
  }

  return { resolved, picks: kept };
}

/** The real winner's team id, once the match has been played. */
export function realWinner(match: BracketMatch): string | null {
  if (!match.finished || !match.winner) return null;
  return match.winner === 1 ? match.team1 : match.team2;
}

/** The grand final: the upper-section match with no next match, in the last round. */
export function grandFinal(matches: BracketMatch[]): BracketMatch | undefined {
  return matches
    .filter((m) => !m.winnerTo)
    .sort((a, b) => b.round - a.round)[0];
}

/** Column headings: "Upper Quarterfinals", "Lower Round 1", "Grand Final"... */
export function roundNames(matches: BracketMatch[]): Map<string, string> {
  const names = new Map<string, string>();
  const final = grandFinal(matches);
  const key = (section: string, round: number) => `${section}:${round}`;

  const upperRounds = [
    ...new Set(matches.filter((m) => m.section === "upper" && m.id !== final?.id).map((m) => m.round)),
  ].sort((a, b) => a - b);
  const upperNames = ["Upper Final", "Upper Semifinals", "Upper Quarterfinals"];
  upperRounds.forEach((round, index) => {
    const fromEnd = upperRounds.length - 1 - index;
    names.set(key("upper", round), upperNames[fromEnd] ?? `Upper Round ${index + 1}`);
  });

  const lowerRounds = [
    ...new Set(matches.filter((m) => m.section === "lower").map((m) => m.round)),
  ].sort((a, b) => a - b);
  lowerRounds.forEach((round, index) => {
    const fromEnd = lowerRounds.length - 1 - index;
    names.set(
      key("lower", round),
      fromEnd === 0 ? "Lower Final" : fromEnd === 1 ? "Lower Semifinal" : `Lower Round ${index + 1}`,
    );
  });

  if (final) names.set(key(final.section, final.round), "Grand Final");
  return names;
}

// --- Deadlines -----------------------------------------------------------------

/**
 * When a stage's picks lock (mirrors the database function
 * public.pickem_deadline, which enforces it): the group stage at the event's
 * prediction deadline; the playoffs at the admin's playoff_deadline if set,
 * else when the first playoff match starts, or
 * at the event's end while no match times are known.
 */
export function stageDeadline(
  stage: "group" | "playoffs",
  event: { prediction_deadline: string; end_date: string; playoff_deadline: string | null },
  bracket: BracketMatch[],
): string {
  if (stage === "group") return event.prediction_deadline;
  if (event.playoff_deadline) return event.playoff_deadline;
  const starts = bracket
    .map((match) => match.startsAt)
    .filter((time): time is string => Boolean(time))
    .sort();
  return starts[0] ?? event.end_date;
}
