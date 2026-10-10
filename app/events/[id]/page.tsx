import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { EventView } from "@/components/EventView";
import { maybeAutoSync } from "@/lib/auto-sync";
import { getEvent, isEventId } from "@/lib/events";
import { getLeaderboard, preloadLeaderboard } from "@/lib/leaderboard";
import { getPickemData, preloadPickemData } from "@/lib/pickem-data";

// Cached on Vercel's network and rebuilt at most once a minute, so event
// pages load fast worldwide. Each event is built the first time it's opened
// (no list at build time). Admin changes and manual syncs clear the cache
// straight away (app/api/revalidate/route.ts, app/api/admin/sync/route.ts).
export const revalidate = 60;

export async function generateStaticParams() {
  return [];
}

// Room for an automatic Liquipedia sync after the page is sent.
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { event } = await getEvent(id);
  return { title: event ? `${event.name} | Dota 2 Predictions` : undefined };
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;

  // Start every query at once instead of one after another.
  if (isEventId(id)) {
    preloadPickemData(id);
    preloadLeaderboard(id);
  }
  const { event, error } = await getEvent(id);

  if (error) {
    return (
      <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4">
        <p className="max-w-xl rounded-xl border border-accent/30 bg-panel px-6 py-4 text-center text-sm text-paper/80">
          {error}
        </p>
        <Link href="/" className="text-sm text-paper/70 underline hover:text-paper">
          Back to events
        </Link>
      </main>
    );
  }

  if (!event) {
    notFound();
  }

  // Live events with auto-sync on refresh from Liquipedia in the background
  // (at most every 30 minutes); the next page load shows the new results.
  after(() => maybeAutoSync(event.id));

  const pickemData = await getPickemData(event.id, event.group_format);
  const leaderboard = await getLeaderboard(event.id, pickemData);
  return (
    <EventView event={event} pickemData={pickemData} leaderboard={leaderboard} />
  );
}
