import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getSiteSettings } from "@/lib/site-settings";

/**
 * GET /og — the 1200x630 preview image shown when the homepage (or any page
 * without its own image) is shared on Discord, X, etc.: the site title over
 * the darkened site background. Event pages use their banner instead.
 */

// Rebuilt at most every 10 minutes (the title can change in Admin → Site).
export const revalidate = 600;

export async function GET() {
  const { site_title } = await getSiteSettings();
  const background = await readFile(join(process.cwd(), "public/backgrounds/og-bg.jpg"));
  const backgroundSrc = `data:image/jpeg;base64,${background.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", background: "#071318" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={backgroundSrc} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0 }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(7,19,24,0.62)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 22,
            margin: "auto 64px",
            padding: "48px 56px",
            width: 1072,
            borderRadius: 28,
            border: "2px solid rgba(29,158,117,0.6)",
            backgroundColor: "rgba(13,29,34,0.88)",
          }}
        >
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 6, color: "#5DCAA5", textTransform: "uppercase" }}>
            Rank the teams. Call the results.
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.05, color: "#E1F5EE" }}>{site_title}</div>
          <div style={{ display: "flex", fontSize: 30, color: "#9FE1CB" }}>Tier lists and pick&apos;ems for Dota 2 events</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
