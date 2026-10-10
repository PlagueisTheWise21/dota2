import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventView } from "@/components/EventView";
import { getEvent } from "@/lib/events";
import { getLeaderboard } from "@/lib/leaderboard";
import { getPickemData } from "@/lib/pickem-data";

// Always read the event from Supabase on request, so dashboard edits show up
// without rebuilding the site.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { event } = await getEvent(id);
  return { title: event ? `${event.name} | Dota 2 Predictions` : undefined };
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const { event, error } = await getEvent(id);

  if (error) {
    return (
      <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4">
        <p className="max-w-xl border-2 border-black bg-panel px-6 py-4 text-center text-sm text-paper/80">
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

  const pickemData = await getPickemData(event.id, event.group_format);
  const leaderboard = await getLeaderboard(event.id, pickemData);
  return <EventView event={event} pickemData={pickemData} leaderboard={leaderboard} />;
}
