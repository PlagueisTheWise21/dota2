/**
 * Team rosters for the stream overlay (/overlay), read from Liquipedia's data
 * for a tournament page (its placement table lists each team's players with
 * their position). Server only: uses LIQUIPEDIA_API_KEY. Cached for an hour.
 */

export const DEFAULT_OVERLAY_TOURNAMENT = "1win_Essence/3";

export type OverlayTeam = {
  name: string;
  /** Display names, ordered carry, mid, offlane, soft support, hard support. */
  players: string[];
};

type Placement = {
  opponentname: string;
  opponentplayers?: Record<string, string> | null;
};

export async function getOverlayTeams(page: string = DEFAULT_OVERLAY_TOURNAMENT): Promise<OverlayTeam[]> {
  const apiKey = process.env.LIQUIPEDIA_API_KEY;
  if (!apiKey) throw new Error("LIQUIPEDIA_API_KEY is not set");

  const url = new URL("https://api.liquipedia.net/api/v3/placement");
  url.search = new URLSearchParams({
    wiki: "dota2",
    conditions: `[[parent::${page.replace(/ /g, "_")}]]`,
    limit: "100",
  }).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Apikey ${apiKey}`, "User-Agent": "dota2-predictions-overlay/1.0" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Liquipedia answered ${response.status}`);
  const { result } = (await response.json()) as { result?: Placement[] };

  const teams = new Map<string, OverlayTeam>();
  for (const row of result ?? []) {
    const players = row.opponentplayers ?? {};
    // p1..p6 with their position in pNrole1 ("1" = carry ... "5" = hard support).
    const listed = [1, 2, 3, 4, 5, 6, 7]
      .filter((i) => players[`p${i}`])
      .map((i) => ({
        name: players[`p${i}dn`] || players[`p${i}`].replace(/_\(.*\)$/, "").replace(/_/g, " "),
        role: Number(players[`p${i}role1`]) || 9 + i,
      }))
      .sort((a, b) => a.role - b.role)
      .slice(0, 5)
      .map((player) => player.name);
    if (!row.opponentname || row.opponentname === "TBD" || listed.length === 0) continue;
    teams.set(row.opponentname, { name: row.opponentname.replace(/ \(team\)$/, ""), players: listed });
  }
  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Overlay layout (1920x1080), all adjustable from the page. */
export type OverlayLayout = {
  /** Top of the name labels, px from the top of the screen. */
  y: number;
  /** Distance between neighbouring hero portraits, px. */
  step: number;
  /** Centre of the first Radiant portrait (carry), px from the left. */
  radiantX: number;
  /** Centre of the first Dire portrait, px from the left. */
  direX: number;
  /** Text size, px. */
  size: number;
};

/**
 * Measured from a 1080p Dota 2 screenshot (owner's, 16 November 2026): portraits
 * 63 px apart, Radiant centres from 571, Dire from 1094, portrait bottoms at ~40 px.
 */
export const DEFAULT_LAYOUT: OverlayLayout = { y: 44, step: 63, radiantX: 571, direX: 1094, size: 13 };

export function layoutFromParams(params: URLSearchParams): OverlayLayout {
  const read = (key: keyof OverlayLayout, min: number, max: number) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && params.has(key) ? Math.min(max, Math.max(min, value)) : DEFAULT_LAYOUT[key];
  };
  return {
    y: read("y", 0, 1080),
    step: read("step", 20, 200),
    radiantX: read("radiantX", 0, 1920),
    direX: read("direX", 0, 1920),
    size: read("size", 8, 48),
  };
}
