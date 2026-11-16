import type { Metadata } from "next";
import { OverlayBuilder } from "@/components/OverlayBuilder";
import { DEFAULT_OVERLAY_TOURNAMENT, getOverlayTeams, type OverlayTeam } from "@/lib/overlay-teams";

export const metadata: Metadata = { title: "Stream overlay", robots: { index: false, follow: false } };

// Rosters come from Liquipedia (cached for an hour inside getOverlayTeams).
export const revalidate = 3600;

/**
 * /overlay: pick the Radiant and Dire teams and get a transparent PNG with
 * the players' names to put under the in-game top bar (for OBS).
 */
export default async function OverlayPage() {
  let teams: OverlayTeam[] = [];
  let error: string | null = null;
  try {
    teams = await getOverlayTeams(DEFAULT_OVERLAY_TOURNAMENT);
  } catch (reason) {
    error = reason instanceof Error ? reason.message : String(reason);
  }
  return <OverlayBuilder teams={teams} error={error} tournament={DEFAULT_OVERLAY_TOURNAMENT} />;
}
