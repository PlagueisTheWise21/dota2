import Link from "next/link";
import { FallbackImage } from "@/components/FallbackImage";
import { HomeAccount } from "@/components/HomeAccount";
import { LocalTime } from "@/components/LocalTime";
import { SiteFooter } from "@/components/SiteFooter";
import { StatusTag } from "@/components/StatusTag";
import { getEvents, type EventSummary } from "@/lib/events";

// Cached on Vercel's network and rebuilt at most once a minute, so the page
// loads fast worldwide. Admin changes clear the cache straight away
// (app/api/revalidate/route.ts).
export const revalidate = 60;

// Edit the homepage wording here.
const SITE_NAME = "Dota 2 Predictions";
const TAGLINE = "Rank the teams. Call the results.";

/**
 * Homepage: top bar, then the first event (live or next up) as a large
 * featured card with the rest listed beside it, over the site background
 * (components/SiteBackground.tsx). Fits the screen without scrolling; the event
 * list scrolls inside itself when there are many events.
 */
export default async function HomePage() {
  const { events, error } = await getEvents();
  const [featured, ...rest] = events;

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden text-[#E1F5EE]">
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-[#1D9E75]/20 bg-[#071318]/50 px-4 py-3 backdrop-blur sm:px-8">
        <span className="font-display text-lg font-bold tracking-widest uppercase sm:text-xl">{SITE_NAME}</span>
        <HomeAccount />
      </header>

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-[clamp(0.6rem,2dvh,1.25rem)] px-4 py-[clamp(0.75rem,3dvh,2rem)] sm:px-8">
        <h1 className="shrink-0 text-xs font-semibold tracking-[0.25em] text-[#5DCAA5] uppercase sm:text-sm">
          {TAGLINE}
        </h1>

        {!featured ? (
          <p className="rounded-xl border border-white/10 bg-[#0d1d22]/90 px-6 py-4 text-sm text-[#9FE1CB]">
            {error ?? "No events yet. Check back soon."}
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.6rem,2dvh,1.5rem)] lg:flex-row lg:items-start">
            <FeaturedEvent event={featured} />
            {rest.length > 0 && (
              <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 lg:max-h-full lg:self-stretch">
                {rest.map((event) => (
                  <li key={event.id}>
                    <EventRow event={event} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}

function Banner({ event }: { event: EventSummary }) {
  return (
    <FallbackImage
      src={event.image_url}
      alt=""
      className="h-full w-full object-contain"
      fallback={
        <span className="flex h-full items-center justify-center p-4 text-center font-display text-xl font-bold tracking-wide uppercase">
          {event.name}
        </span>
      }
    />
  );
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Picks lock 22 Oct, 09:00 BST" (visitor's timezone) while group picks are open, else the dates. */
function Detail({ event }: { event: EventSummary }) {
  if (event.status !== "finished" && event.picksOpen) {
    return (
      <>
        Picks lock <LocalTime iso={event.prediction_deadline} />
      </>
    );
  }
  return <>{`${dayFormat.format(new Date(event.start_date))} – ${dayFormat.format(new Date(event.end_date))}`}</>;
}

function FeaturedEvent({ event }: { event: EventSummary }) {
  const href = `/events/${event.id}`;
  return (
    <article className="w-full shrink-0 overflow-hidden rounded-xl border border-[#1D9E75]/60 bg-[#0d1d22]/90 shadow-2xl shadow-black/50 lg:max-w-[min(44rem,calc((100dvh-17rem)*16/9))] lg:flex-[1.7]">
      <Link href={href} aria-label={event.name} className="block aspect-video bg-black/40 transition hover:brightness-110">
        <Banner event={event} />
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-[clamp(0.75rem,2dvh,1.25rem)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusTag status={event.status} />
            <span className="text-xs text-[#9FE1CB]/70"><Detail event={event} /></span>
          </div>
          <h2 className="mt-1.5 truncate font-display text-[clamp(1.4rem,3.5dvh,2rem)] leading-tight font-bold tracking-wide uppercase">
            <Link href={href} className="hover:text-white">
              {event.name}
            </Link>
          </h2>
        </div>
        <div className="flex gap-2">
          <Link
            href={`${href}?tab=pickems`}
            className="rounded-lg bg-[#0F6E56] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#0F6E56]/30 transition-colors hover:bg-[#1D9E75]"
          >
            {event.status === "finished" ? "See results" : "Make your picks"}
          </Link>
          <Link
            href={`${href}?tab=leaderboard`}
            className="rounded-lg border border-[#378ADD] px-4 py-2 text-sm font-semibold text-[#B5D4F4] transition-colors hover:bg-[#378ADD]/15"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </article>
  );
}

function EventRow({ event }: { event: EventSummary }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex gap-3 rounded-xl border border-white/10 bg-[#0d1d22]/90 p-2.5 transition hover:-translate-y-0.5 hover:border-[#1D9E75]/70"
    >
      <span className="block aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-black/40 sm:w-40">
        <Banner event={event} />
      </span>
      <span className="flex min-w-0 flex-col justify-center gap-1">
        <StatusTag status={event.status} />
        <span className="truncate font-semibold">{event.name}</span>
        <span className="text-xs text-[#9FE1CB]/70"><Detail event={event} /></span>
      </span>
    </Link>
  );
}
