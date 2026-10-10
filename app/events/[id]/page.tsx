import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { EventView } from "@/components/EventView";
import { maybeAutoSync } from "@/lib/auto-sync";
import { getEvent, isEventId } from "@/lib/events";
import { getLeaderboard, preloadLeaderboard } from "@/lib/leaderboard";
import { getPickemData, preloadPickemData } from "@/lib/pickem-data";
import { getSiteSettings } from "@/lib/site-settings";

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
  if (!event) return {};
  const { site_title } = await getSiteSettings();
  // Times in link previews are UTC: the reader's timezone isn't known here.
  const deadline = Date.parse(event.prediction_deadline) > Date.now()
    ? ` Picks lock ${new Date(event.prediction_deadline).toUTCString().slice(5, 22)} UTC.`
    : "";
  const description = `Make your Dota 2 tier list and pick'em for ${event.name}.${deadline}`;
  const images = event.image_url ? [{ url: event.image_url, alt: event.name }] : [{ url: "/og", width: 1200, height: 630 }];
  return {
    // The layout adds " | <site title>" (admin Site settings).
    title: event.name,
    description,
    openGraph: { type: "website", siteName: site_title, title: `${event.name} | ${site_title}`, description, images },
    twitter: { card: "summary_large_image", title: `${event.name} | ${site_title}`, description, images },
  };
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
