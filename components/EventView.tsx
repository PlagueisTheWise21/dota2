"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyImageButton } from "@/components/CopyImageButton";
import { Panel } from "@/components/Panel";
import { Pickems, initialPickemState, type PickemState } from "@/components/Pickems";
import { TierList, initialPlacements, type Placements } from "@/components/TierList";
import type { EventDetails } from "@/lib/events";
import type { PickemData } from "@/lib/pickems";
import { renderTierListPng } from "@/lib/tier-image";

const SECTIONS = [
  { id: "tier-list", label: "Tier List" },
  { id: "pickems", label: "Pick'em" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

type EventViewProps = {
  event: EventDetails;
  /** Group stage and bracket from Liquipedia (lib/pickem-data.ts). */
  pickemData: PickemData;
};

/**
 * The event page: title, then a switch between the tier list and the
 * pick'em. Switching happens in the page, with no navigation, and both keep
 * their state while the other is shown. Neither is saved yet.
 */
export function EventView({ event, pickemData }: EventViewProps) {
  const [section, setSection] = useState<SectionId>("tier-list");
  const [placements, setPlacements] = useState<Placements>(() =>
    initialPlacements(event.teams),
  );
  const [pickems, setPickems] = useState<PickemState>(() =>
    initialPickemState(pickemData),
  );

  return (
    <main className="flex h-dvh w-full flex-col items-center gap-[clamp(0.5rem,2dvh,1.25rem)] overflow-hidden px-4 py-[clamp(0.5rem,2.5dvh,1.5rem)] sm:px-8">
      {/* Phones and tablets: title on top, home button and controls below.
          Laptops and up: home button | title | controls on one row. */}
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
          aria-label="Home"
          title="Home"
          className="shadow-offset flex items-center gap-2 justify-self-start border-2 border-paper/60 bg-panel px-[clamp(0.6rem,1.5vw,0.9rem)] py-[calc(clamp(0.2rem,0.9dvh,0.45rem)+1px)] font-display text-[clamp(0.85rem,min(2vw,2.8dvh),1.15rem)] font-bold tracking-widest whitespace-nowrap text-paper uppercase transition-colors hover:border-paper lg:col-start-1 lg:row-start-1"
        >
          <HomeIcon />
          <span className="hidden sm:inline">Home</span>
        </Link>

        <div className="flex items-stretch gap-3 justify-self-end lg:col-start-3 lg:row-start-1">
          {event.teams.length > 0 && section === "tier-list" && (
            <CopyImageButton
              what="tier list"
              fileName={`${fileSlug(event.name)}-tier-list.png`}
              render={() => renderTierListPng(event.name, event.teams, placements)}
            />
          )}

          <div
            role="tablist"
            aria-label="Event sections"
            className="shadow-offset flex border-2 border-paper/60 bg-panel"
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
                  className={`cursor-pointer px-[clamp(0.9rem,3vw,1.75rem)] py-[calc(clamp(0.2rem,0.9dvh,0.45rem)+1px)] font-display text-[clamp(0.85rem,min(2vw,2.8dvh),1.15rem)] font-bold tracking-widest whitespace-nowrap uppercase transition-colors not-last:border-r not-last:border-paper/30 ${
                    selected
                      ? "bg-[#2a2a2a] text-paper shadow-[inset_0_-3px_0_0_#e8ecf1]"
                      : "text-paper/50 hover:text-paper"
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
          <Pickems
            event={event}
            data={pickemData}
            state={pickems}
            onChange={setPickems}
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

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[1.1em] w-[1.1em]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="square"
    >
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </svg>
  );
}

/** "Blast Slam VIII" -> "blast-slam-viii", for download file names. */
function fileSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
