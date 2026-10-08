import Link from "next/link";
import { FallbackImage } from "@/components/FallbackImage";
import type { EventSummary } from "@/lib/events";

type EventCardProps = {
  event: EventSummary;
};

/**
 * A clickable 16:9 event banner linking to /events/[id].
 * Shows the event name as a placeholder when there is no image_url or the
 * image fails to load.
 */
export function EventCard({ event }: EventCardProps) {
  return (
    <Link
      href={`/events/${event.id}`}
      aria-label={event.name}
      className="event-card group relative block aspect-video w-full cursor-pointer overflow-hidden border-2 border-black bg-panel"
    >
      {/* object-contain: the whole image always shows. 16:9 banners fill the
          card exactly; wider or taller ones sit on the dark card background. */}
      <FallbackImage
        src={event.image_url}
        alt={event.name}
        className="h-full w-full object-contain"
        fallback={
          <span className="flex h-full w-full items-center justify-center border border-white/10 p-4 text-center font-display text-[clamp(1rem,2.2vw,1.75rem)] leading-tight font-bold tracking-wide text-paper uppercase">
            {event.name}
          </span>
        }
      />
    </Link>
  );
}
