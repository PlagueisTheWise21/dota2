import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import {
  DEFAULT_OVERLAY_TOURNAMENT,
  getOverlayTeams,
  layoutFromParams,
  RESOLUTIONS,
  resolutionFromParams,
} from "@/lib/overlay-teams";

/**
 * GET /overlay/image?radiant=<team>&dire=<team>[&rorder=…&dorder=…&res=1080p|1440p|4k&page=…&y=…&step=…&radiantX=…&direX=…&size=…]
 *
 * A transparent PNG, 2560x1440 by default (?res= can ask for 1080p or 4K) with the ten player names placed under the
 * Dota 2 top bar hero portraits: Radiant on the left, Dire on the right, each
 * carry, mid, offlane, soft support, hard support from left to right. Right-
 * click → Save image, or use this address as an OBS image / browser source.
 */

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = params.get("page") || DEFAULT_OVERLAY_TOURNAMENT;
  const { width, height } = RESOLUTIONS[resolutionFromParams(params)];
  // Layout values are in 1080p pixels; the in-game HUD scales with height.
  const scale = height / 1080;
  const base = layoutFromParams(params);
  const layout = {
    y: base.y * scale,
    step: base.step * scale,
    radiantX: base.radiantX * scale,
    direX: base.direX * scale,
    size: base.size * scale,
    logoSize: base.logoSize * scale,
    logoY: base.logoY * scale,
  };

  let teams;
  try {
    teams = await getOverlayTeams(page);
  } catch (reason) {
    return new Response(`Rosters could not be loaded: ${reason instanceof Error ? reason.message : reason}`, { status: 502 });
  }
  const radiant = teams.find((team) => team.name === params.get("radiant"));
  const dire = teams.find((team) => team.name === params.get("dire"));

  const [radiantLogo, direLogo] = await Promise.all([logoDataUrl(radiant?.logoUrl), logoDataUrl(dire?.logoUrl)]);
  // Logos sit just outside the outermost portraits: left of the Radiant carry,
  // right of the fifth Dire hero.
  const logoGap = 6 * scale;
  const radiantLogoRight = layout.radiantX - layout.step / 2 - logoGap;
  const direLogoLeft = layout.direX + 4 * layout.step + layout.step / 2 + logoGap;
  const logoBox = { width: layout.logoSize * 1.5, height: layout.logoSize };

  const labelWidth = layout.step + 30;
  const labels = [
    ...ordered(radiant?.players, params.get("rorder")).map((name, index) => ({ name, x: layout.radiantX + index * layout.step })),
    ...ordered(dire?.players, params.get("dorder")).map((name, index) => ({ name, x: layout.direX + index * layout.step })),
  ];

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width, height }}>
        {radiantLogo && layout.logoSize > 0 && (
          <div
            style={{
              position: "absolute",
              top: layout.logoY,
              left: radiantLogoRight - logoBox.width,
              ...logoBox,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={radiantLogo} alt="" style={{ maxWidth: logoBox.width, maxHeight: logoBox.height, objectFit: "contain" }} />
          </div>
        )}
        {direLogo && layout.logoSize > 0 && (
          <div
            style={{
              position: "absolute",
              top: layout.logoY,
              left: direLogoLeft,
              ...logoBox,
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={direLogo} alt="" style={{ maxWidth: logoBox.width, maxHeight: logoBox.height, objectFit: "contain" }} />
          </div>
        )}
        {labels.map((label, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              top: layout.y,
              left: label.x - labelWidth / 2,
              width: labelWidth,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#ffffff",
                fontSize: layout.size,
                fontWeight: 700,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                // Small white text; a soft dark edge keeps it readable over bright map areas.
                textShadow: "0 0 3px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.95)",
              }}
            >
              {label.name}
            </div>
          </div>
        ))}
      </div>
    ),
    {
      width,
      height,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
    },
  );
}

/** A logo as a data URL (the image renderer needs the bytes), or null. Cached for a day. */
async function logoDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "dota2-predictions-overlay/1.0" },
      next: { revalidate: 86400 },
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpeg)/.test(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The players in the order chosen on the page (`rorder` / `dorder`: roster
 * indices per slot, left to right, e.g. "2,0,1,3,4"); position order if missing or invalid.
 */
function ordered(players: string[] | undefined, order: string | null): string[] {
  if (!players) return [];
  const indices = (order ?? "").split(",").filter(Boolean).map(Number);
  const valid =
    indices.length === players.length &&
    new Set(indices).size === indices.length &&
    indices.every((index) => Number.isInteger(index) && index >= 0 && index < players.length);
  return valid ? indices.map((index) => players[index]) : players;
}
