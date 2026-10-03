"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventCard } from "@/components/EventCard";
import type { EventSummary } from "@/lib/events";

type EventCarouselProps = {
  events: EventSummary[];
};

/**
 * Horizontal row of event banners (about 3 on desktop, 2 on tablets, 1 on
 * phones; sizes live in globals.css under ".event-track").
 * Arrow buttons only appear when the banners do not all fit.
 */
export function EventCarousel({ events }: EventCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canGoPrev, setCanGoPrev] = useState(false);
  const [canGoNext, setCanGoNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanGoPrev(track.scrollLeft > 1);
    setCanGoNext(track.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // The observer fires once straight away, then on every resize.
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    track.addEventListener("scroll", updateArrows, { passive: true });

    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", updateArrows);
    };
  }, [updateArrows, events.length]);

  /** Moves the carousel by one banner. direction: -1 = left, 1 = right. */
  function move(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector<HTMLElement>("[data-slide]");
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = slide ? slide.offsetWidth + gap : track.clientWidth;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  const showArrows = canGoPrev || canGoNext;

  return (
    <div className="flex w-full items-center gap-2 sm:gap-4">
      {showArrows && (
        <CarouselArrow
          direction="prev"
          disabled={!canGoPrev}
          onClick={() => move(-1)}
        />
      )}

      <div ref={trackRef} className="event-track min-w-0 flex-1">
        {events.map((event) => (
          <div key={event.id} data-slide className="event-slide">
            <EventCard event={event} />
          </div>
        ))}
      </div>

      {showArrows && (
        <CarouselArrow
          direction="next"
          disabled={!canGoNext}
          onClick={() => move(1)}
        />
      )}
    </div>
  );
}

type CarouselArrowProps = {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
};

function CarouselArrow({ direction, disabled, onClick }: CarouselArrowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous events" : "Next events"}
      className="shadow-offset flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-2 border-paper/60 bg-panel font-display text-xl font-bold text-paper transition-colors hover:border-paper disabled:cursor-default disabled:opacity-30 disabled:hover:border-paper/60 sm:h-12 sm:w-12 sm:text-2xl"
    >
      <span aria-hidden="true">{direction === "prev" ? "<" : ">"}</span>
    </button>
  );
}
