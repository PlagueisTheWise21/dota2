"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyTierListButton } from "@/components/CopyTierListButton";
import { Panel } from "@/components/Panel";
import {
  Predictions,
  emptyPrediction,
  type PredictionSlots,
} from "@/components/Predictions";
import { TierList, initialPlacements, type Placements } from "@/components/TierList";
import type { EventDetails } from "@/lib/events";

const SECTIONS = [
  { id: "tier-list", label: "Tier List" },
  { id: "predictions", label: "Predictions" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

type EventViewProps = {
  event: EventDetails;
};

/**
 * The event page: title, then a switch between the tier list and
 * predictions. Switching happens in the page, with no navigation, and both
 * keep their state while the other is shown. Neither is saved yet.
 */
export function EventView({ event }: EventViewProps) {
  const [section, setSection] = useState<SectionId>("tier-list");
  const [placements, setPlacements] = useState<Placements>(() =>
    initialPlacements(event.teams),
  );
  const [prediction, setPrediction] = useState<PredictionSlots>(() =>
    emptyPrediction(event.teams),
  );

  return (
    <main className="flex h-dvh w-full flex-col items-center gap-[clamp(0.5rem,2dvh,1.25rem)] overflow-hidden px-4 py-[clamp(0.5rem,2.5dvh,1.5rem)] sm:px-8">
      {/* Phones and tablets: title on top, back link and controls below.
          Laptops and up: back link | title | controls on one row. */}
      <header className="grid w-full max-w-6xl grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 lg:grid-cols-[1fr_auto_1fr]">
        <Panel className="col-span-2 px-6 py-[clamp(0.3rem,1.2dvh,0.75rem)] text-center lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:max-w-xl">
          <h1 className="font-display text-[clamp(1.2rem,min(3.2vw,5dvh),2.1rem)] leading-tight font-bold tracking-wide uppercase">
            {event.name}
          </h1>
          <p className="text-[clamp(0.7rem,min(1.4vw,2dvh),0.85rem)] font-medium tracking-wide">
            {formatDateRange(event.start_date, event.end_date)}
            <span className="mx-2 opacity-40">/</span>
            <span className="uppercase">{event.status}</span>
          </p>
        </Panel>

        <Link
          href="/"
          className="justify-self-start text-sm whitespace-nowrap text-paper/70 underline-offset-4 hover:text-paper hover:underline lg:col-start-1 lg:row-start-1"
        >
          &larr; Events
        </Link>

        <div className="flex items-stretch gap-3 justify-self-end lg:col-start-3 lg:row-start-1">
          {section === "tier-list" && event.teams.length > 0 && (
            <CopyTierListButton
              eventName={event.name}
              teams={event.teams}
              placements={placements}
            />
          )}

          <div
            role="tablist"
            aria-label="Event sections"
            className="shadow-offset flex border-[3px] border-black"
          >
            {SECTIONS.map((item) => {
              const selected = item.id === section;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${item.id}`}
                  onClick={() => setSection(item.id)}
                  className={`cursor-pointer px-[clamp(0.9rem,3vw,1.75rem)] py-[clamp(0.2rem,0.9dvh,0.45rem)] font-display text-[clamp(0.85rem,min(2vw,2.8dvh),1.15rem)] font-bold tracking-widest whitespace-nowrap uppercase transition not-last:border-r-[3px] not-last:border-black ${
                    selected
                      ? "bg-paper text-steel"
                      : "bg-panel text-paper/60 hover:text-paper"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <section
        id={`panel-${section}`}
        role="tabpanel"
        aria-labelledby={`tab-${section}`}
        className="flex min-h-0 w-full flex-1 justify-center"
      >
        {section === "tier-list" ? (
          <TierList
            teams={event.teams}
            placements={placements}
            onChange={setPlacements}
          />
        ) : (
          <Predictions
            teams={event.teams}
            slots={prediction}
            onChange={setPrediction}
            deadline={event.prediction_deadline}
          />
        )}
      </section>
    </main>
  );
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  timeZone: "UTC",
});
const fullFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "14 – 28 Aug 2026", or "29 Sept 2026 – 11 Oct 2026" across months. */
function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameMonth =
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth();
  const startText = sameMonth
    ? dayFormat.format(startDate)
    : fullFormat.format(startDate);
  return `${startText} – ${fullFormat.format(endDate)}`;
}
