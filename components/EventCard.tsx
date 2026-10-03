"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageFailed, setImageFailed] = useState(false);

  // Catches images that already failed before React attached onError.
  useEffect(() => {
    const image = imageRef.current;
    if (image && image.complete && image.naturalWidth === 0) {
      setImageFailed(true);
    }
  }, [event.image_url]);

  const showImage = Boolean(event.image_url) && !imageFailed;

  return (
    <Link
      href={`/events/${event.id}`}
      aria-label={event.name}
      className="event-card group relative block aspect-video w-full cursor-pointer overflow-hidden border-2 border-black bg-panel"
    >
      {showImage ? (
        // A plain <img> is used on purpose: banner URLs come from Supabase and
        // can point at any host, which next/image would need configuring for.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imageRef}
          src={event.image_url ?? undefined}
          alt={event.name}
          draggable={false}
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center border border-white/10 p-4 text-center font-display text-[clamp(1rem,2.2vw,1.75rem)] leading-tight font-bold tracking-wide text-paper uppercase">
          {event.name}
        </span>
      )}
    </Link>
  );
}
