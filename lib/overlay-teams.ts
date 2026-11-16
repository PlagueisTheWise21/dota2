/**
 * Team rosters for the stream overlay (/overlay), read from Liquipedia's data
 * for a tournament page (its placement table lists each team's players with
 * their position). Server only: uses LIQUIPEDIA_API_KEY. Cached for an hour.
 */

export const DEFAULT_OVERLAY_TOURNAMENT = "1win_Essence/3";

export type OverlayTeam = {
  name: string;
  /** Team logo for dark backgrounds (Liquipedia team template), or null. */
  logoUrl: string | null;
  /** Display names, ordered carry, mid, offlane, soft support, hard support. */
  players: string[];
};

type Placement = {
  opponentname: string;
  opponenttemplate?: string;
  opponentplayers?: Record<string, string> | null;
};

const HEADERS = (apiKey: string) => ({ Authorization: `Apikey ${apiKey}`, "User-Agent": "dota2-predictions-overlay/1.0" });

/** A team template's logo URL (dark-mode version first), cached for a day. */
async function teamLogo(apiKey: string, template: string | undefined): Promise<string | null> {
  if (!template) return null;
  try {
    const url = new URL("https://api.liquipedia.net/api/v3/teamtemplate");
    url.search = new URLSearchParams({ wiki: "dota2", template }).toString();
    const response = await fetch(url, { headers: HEADERS(apiKey), next: { revalidate: 86400 } });
    if (!response.ok) return null;
    const { result } = (await response.json()) as { result?: { imagedarkurl?: string; imageurl?: string }[] };
    return result?.[0]?.imagedarkurl || result?.[0]?.imageurl || null;
  } catch {
    return null;
  }
}

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
    headers: HEADERS(apiKey),
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Liquipedia answered ${response.status}`);
  const { result } = (await response.json()) as { result?: Placement[] };

  const teams = new Map<string, OverlayTeam & { template?: string }>();
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
    teams.set(row.opponentname, {
      name: row.opponentname.replace(/ \(team\)$/, ""),
      logoUrl: null,
      players: listed,
      template: row.opponenttemplate,
    });
  }
  const list = [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
  const logos = await Promise.all(list.map((team) => teamLogo(apiKey, team.template)));
  return list.map((team, index) => ({ name: team.name, players: team.players, logoUrl: logos[index] }));
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
  /** Logo height (and max width), px. */
  logoSize: number;
  /** Top of the logos, px from the top of the screen. */
  logoY: number;
};

/**
 * Measured from a 1080p Dota 2 screenshot (owner's, 16 November 2026): portraits
 * 63 px apart, Radiant centres from 571, Dire from 1094, portrait bottoms at ~40 px.
 */
export const DEFAULT_LAYOUT: OverlayLayout = { y: 44, step: 63, radiantX: 571, direX: 1094, size: 13, logoSize: 40, logoY: 1 };

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
    logoSize: read("logoSize", 0, 200),
    logoY: read("logoY", 0, 1080),
  };
}

/** Output sizes for the overlay image (16:9). The HUD scales with screen height. */
export const RESOLUTIONS = {
  "1080p": { label: "1080p (1920×1080)", width: 1920, height: 1080 },
  "1440p": { label: "1440p (2560×1440)", width: 2560, height: 1440 },
  "4k": { label: "4K (3840×2160)", width: 3840, height: 2160 },
} as const;

export type Resolution = keyof typeof RESOLUTIONS;

export function resolutionFromParams(params: URLSearchParams): Resolution {
  const value = params.get("res");
  return value && value in RESOLUTIONS ? (value as Resolution) : "1080p";
}
