import { EventCarousel } from "@/components/EventCarousel";
import { Panel } from "@/components/Panel";
import { getEvents } from "@/lib/events";

// Always read events from Supabase on request, so dashboard edits show up
// without rebuilding the site.
export const dynamic = "force-dynamic";

// Edit the homepage wording here.
const WELCOME_TITLE = "Dota 2 Predictions & Tier Lists";
const WELCOME_SUBTITLE = "Rank the teams. Call the results.";

export default async function HomePage() {
  const { events, error } = await getEvents();

  return (
    <main className="flex h-dvh w-full flex-col items-center justify-center gap-[clamp(1rem,5dvh,3.5rem)] overflow-hidden px-4 py-[clamp(1rem,4dvh,3rem)] sm:px-8">
      <Panel className="w-full max-w-4xl px-6 py-[clamp(1rem,4dvh,2.75rem)] text-center">
        <h1 className="font-display text-[clamp(1.6rem,min(5.5vw,9dvh),4rem)] leading-tight font-bold tracking-wide uppercase">
          {WELCOME_TITLE}
        </h1>
        <p className="mt-2 text-[clamp(0.85rem,min(1.8vw,3dvh),1.25rem)] font-medium tracking-wide">
          {WELCOME_SUBTITLE}
        </p>
      </Panel>

      <section
        aria-labelledby="events-heading"
        className="flex w-full max-w-6xl flex-col items-center gap-[clamp(0.5rem,2.5dvh,1.5rem)]"
      >
        <Panel className="px-10 py-[clamp(0.35rem,1.2dvh,0.75rem)] sm:px-16">
          <h2
            id="events-heading"
            className="font-display text-[clamp(1.2rem,min(3vw,5dvh),2.25rem)] font-bold tracking-widest uppercase"
          >
            Events
          </h2>
        </Panel>

        {events.length > 0 ? (
          <EventCarousel events={events} />
        ) : (
          <p className="max-w-xl border-2 border-black bg-panel px-6 py-4 text-center text-sm text-paper/80">
            {error ?? "No events yet. Check back soon."}
          </p>
        )}
      </section>
    </main>
  );
}
