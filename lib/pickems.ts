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
  winnerTo: string | null;
  winnerToSlot: 1 | 2 | null;
  loserTo: string | null;
  loserToSlot: 1 | 2 | null;
};

/** A team's final group stage record. */
export type GroupRecord = { teamId: string; wins: number; losses: number };

export type PickemData = {
  /** Teams playing the (Swiss) group stage; empty when there is none. */
  groupTeamIds: string[];
  /** Final records, only once every team has finished the group stage. */
  groupRecords: GroupRecord[] | null;
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
