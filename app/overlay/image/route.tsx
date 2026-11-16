import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { DEFAULT_OVERLAY_TOURNAMENT, getOverlayTeams, layoutFromParams } from "@/lib/overlay-teams";

/**
 * GET /overlay/image?radiant=<team>&dire=<team>[&page=…&y=…&step=…&radiantX=…&direX=…&size=…]
 *
 * A transparent 1920x1080 PNG with the ten player names placed under the
 * Dota 2 top bar hero portraits: Radiant on the left, Dire on the right, each
 * carry, mid, offlane, soft support, hard support from left to right. Right-
 * click → Save image, or use this address as an OBS image / browser source.
 */

const WIDTH = 1920;
const HEIGHT = 1080;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = params.get("page") || DEFAULT_OVERLAY_TOURNAMENT;
  const layout = layoutFromParams(params);

  let teams;
  try {
    teams = await getOverlayTeams(page);
  } catch (reason) {
    return new Response(`Rosters could not be loaded: ${reason instanceof Error ? reason.message : reason}`, { status: 502 });
  }
  const radiant = teams.find((team) => team.name === params.get("radiant"));
  const dire = teams.find((team) => team.name === params.get("dire"));

  const labelWidth = layout.step + 30;
  const labels = [
    ...(radiant?.players ?? []).map((name, index) => ({ name, x: layout.radiantX + index * layout.step })),
    ...(dire?.players ?? []).map((name, index) => ({ name, x: layout.direX + index * layout.step })),
  ];

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: WIDTH, height: HEIGHT }}>
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
      width: WIDTH,
      height: HEIGHT,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
    },
  );
}
