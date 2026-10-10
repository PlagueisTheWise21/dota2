"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AccountButton } from "@/components/AccountButton";
import { CopyImageButton } from "@/components/CopyImageButton";
import { Leaderboard } from "@/components/Leaderboard";
import { Panel } from "@/components/Panel";
import { StatusTag } from "@/components/StatusTag";
import {
  Pickems,
  initialPickemState,
  type PickemState,
} from "@/components/Pickems";
import type { Slots } from "@/components/SlotBoard";
import {
  TierList,
  initialPlacements,
  type Placements,
} from "@/components/TierList";
import { useAuth } from "@/components/useAuth";
import {
  useDebouncedSave,
  type SaveStatus,
} from "@/components/useDebouncedSave";
import { useNow } from "@/components/useNow";
import type { EventDetails } from "@/lib/events";
import type { Leaderboard as LeaderboardData } from "@/lib/leaderboard";
import {
  groupBoards,
  renderBracketPng,
  renderGroupPickemPng,
} from "@/lib/pickem-image";
import {
  groupSegments,
  resolveBracket,
  stageDeadline,
  type BracketPicks,
  type PickemData,
} from "@/lib/pickems";
import {
  cleanGroupPicks,
  cleanTierList,
  loadPickems,
  loadTierList,
  savePickems,
  saveTierList,
} from "@/lib/saved-picks";
import { renderTierListPng } from "@/lib/tier-image";

const SECTIONS = [
  { id: "tier-list", label: "Tier List" },
  { id: "pickems", label: "Pick'em" },
  { id: "leaderboard", label: "Leaderboard", shortLabel: "Ranks" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

type EventViewProps = {
  event: EventDetails;
  /** Group stage and bracket from Liquipedia (lib/pickem-data.ts). */
  pickemData: PickemData;
  /** Everyone's pick'em scores (lib/leaderboard.ts). */
  leaderboard: LeaderboardData;
};

/**
 * The tab named by ?tab= in the URL (the homepage buttons link to
 * ?tab=pickems and ?tab=leaderboard). Read in the browser, because the page
 * itself is cached and the same for every URL.
 */
function urlSection(): SectionId {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "pickems" || tab === "leaderboard" ? tab : "tier-list";
}
const noSubscribe = () => () => {};

/**
 * The event page: title, then a switch between the tier list and the
 * pick'em. Switching happens in the page, with no navigation, and both keep
 * their state while the other is shown.
 *
 * Signed out, nothing is saved. Signed in with Twitch, the tier list and
 * pick'ems load from and save to Supabase (lib/saved-picks.ts); each pick'em
 * stage locks at its deadline (also enforced by the database).
 */
export function EventView({ event, pickemData, leaderboard }: EventViewProps) {
  // Starts on the tab from the URL; clicking a tab takes over from there.
  const fromUrl = useSyncExternalStore(noSubscribe, urlSection, () => "tier-list" as SectionId);
  const [chosen, setSection] = useState<SectionId | null>(null);
  const section = chosen ?? fromUrl;
  const [placements, setPlacements] = useState<Placements>(() =>
    initialPlacements(event.teams),
  );
  const [pickems, setPickems] = useState<PickemState>(() =>
    initialPickemState(pickemData),
  );

  const auth = useAuth();
  const userId = auth.user?.id ?? null;

  // Deadlines: group picks lock at the event's prediction deadline, playoff
  // picks when the first playoff match starts.
  const now = useNow();
  const groupDeadline = stageDeadline("group", event, pickemData.bracket);
  const playoffsDeadline = stageDeadline("playoffs", event, pickemData.bracket);
  const locked = {
    group: now !== null && now >= Date.parse(groupDeadline),
    playoffs: now !== null && now >= Date.parse(playoffsDeadline),
  };

  const tierSaver = useDebouncedSave<Placements>((value) =>
    saveTierList(userId!, event.id, value),
  );
  const groupSaver = useDebouncedSave<Slots>((value) =>
    savePickems(userId!, event.id, "group", value),
  );
  const playoffsSaver = useDebouncedSave<BracketPicks>((value) =>
    savePickems(userId!, event.id, "playoffs", value),
  );
  const scheduleTier = tierSaver.schedule;
  const scheduleGroup = groupSaver.schedule;
  const schedulePlayoffs = playoffsSaver.schedule;

  // After signing in: load saved picks. Picks made just before signing in
  // (kept through the Twitch redirect) are used where nothing was saved yet.
  const { teams } = event;
  const { bracket } = pickemData;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const stash = takeStash(event.id);

    Promise.all([loadTierList(userId, event.id), loadPickems(userId, event.id)])
      .then(([savedTier, savedPicks]) => {
        if (cancelled) return;
        const teamIds = teams.map((team) => team.id);
        const nowMs = Date.now();

        const tierSource = savedTier ?? stash?.placements ?? null;
        if (tierSource) {
          const tier = cleanTierList(tierSource, teamIds);
          setPlacements(tier);
          if (!savedTier) scheduleTier(tier);
        }

        const segments = groupSegments(pickemData);
        const groupSource = savedPicks.group ?? stash?.groupSlots ?? null;
        const group =
          groupSource && segments.length > 0
            ? cleanGroupPicks(groupSource, segments)
            : null;
        const playoffsSource =
          savedPicks.playoffs ?? stash?.bracketPicks ?? null;
        const playoffs =
          playoffsSource && bracket.length > 0
            ? resolveBracket(bracket, playoffsSource).picks
            : null;

        setPickems((current) => ({
          ...current,
          groupSlots: group ?? current.groupSlots,
          bracketPicks: playoffs ?? current.bracketPicks,
        }));
        if (group && !savedPicks.group && nowMs < Date.parse(groupDeadline))
          scheduleGroup(group);
        if (
          playoffs &&
          !savedPicks.playoffs &&
          nowMs < Date.parse(playoffsDeadline)
        ) {
          schedulePlayoffs(playoffs);
        }
      })
      .catch((error) => console.error("Loading saved picks failed:", error));

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    event.id,
    teams,
    pickemData,
    bracket,
    groupDeadline,
    playoffsDeadline,
    scheduleTier,
    scheduleGroup,
    schedulePlayoffs,
  ]);

  function changePlacements(next: Placements) {
    setPlacements(next);
    if (userId) scheduleTier(next);
  }

  function changePickems(next: PickemState) {
    if (userId && !locked.group && next.groupSlots !== pickems.groupSlots) {
      scheduleGroup(next.groupSlots);
    }
    if (
      userId &&
      !locked.playoffs &&
      next.bracketPicks !== pickems.bracketPicks
    ) {
      schedulePlayoffs(next.bracketPicks);
    }
    setPickems(next);
  }

  function signIn() {
    putStash(event.id, {
      placements,
      groupSlots: pickems.groupSlots,
      bracketPicks: pickems.bracketPicks,
    });
    void auth.signIn();
  }

  const saveStatus = combineStatus([
    tierSaver.status,
    groupSaver.status,
    playoffsSaver.status,
  ]);

  // "Copy image" for whichever board is showing; it sits under the board.
  let copyButton = null;
  if (section === "tier-list" && event.teams.length > 0) {
    copyButton = (
      <CopyImageButton
        what="tier list"
        fileName={`${fileSlug(event.name)}-tier-list.png`}
        render={() => renderTierListPng(event.name, event.teams, placements)}
      />
    );
  } else if (
    section === "pickems" &&
    pickems.section === "group" &&
    groupSegments(pickemData).length > 0
  ) {
    copyButton = (
      <CopyImageButton
        what="group stage pick'em"
        fileName={`${fileSlug(event.name)}-pickem-group-stage.png`}
        render={() =>
          renderGroupPickemPng(
            event.name,
            groupBoards(event.teams, pickemData, pickems.groupSlots),
          )
        }
      />
    );
  } else if (
    section === "pickems" &&
    pickems.section === "playoffs" &&
    pickemData.bracket.length > 0
  ) {
    copyButton = (
      <CopyImageButton
        what="playoff pick'em"
        fileName={`${fileSlug(event.name)}-pickem-playoffs.png`}
        render={() =>
          renderBracketPng(
            event.name,
            event.teams,
            pickemData.bracket,
            pickems.bracketPicks,
          )
        }
      />
    );
  }

  return (
    <main className="flex h-dvh w-full flex-col items-center gap-[clamp(0.5rem,2dvh,1.25rem)] overflow-hidden px-4 py-[clamp(0.5rem,2.5dvh,1.5rem)] sm:px-8">
      {/* Phones and tablets: title on top, home button and controls below.
          Wide screens (1280px+): home button | title | controls on one row. */}
      <header className="grid w-full max-w-7xl grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 xl:grid-cols-[1fr_auto_1fr]">
        <Panel className="col-span-2 px-6 py-[clamp(0.3rem,1.2dvh,0.75rem)] text-center xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:max-w-xl xl:justify-self-center">
          <h1 className="font-display text-[clamp(1.2rem,min(3.2vw,5dvh),2.1rem)] leading-tight font-bold tracking-wide uppercase">
            {event.name}
          </h1>
          <p className="text-[clamp(0.7rem,min(1.4vw,2dvh),0.85rem)] font-medium tracking-wide">
            {formatDateRange(event.start_date, event.end_date)}
            <span className="ml-2 align-middle">
              <StatusTag status={event.status} />
            </span>
          </p>
        </Panel>

        <div className="flex items-stretch gap-3 justify-self-start xl:col-start-1 xl:row-start-1">
          <Link
            href="/"
            aria-label="Home"
            title="Home"
            className="shadow-offset rounded-xl flex items-center gap-2 border border-accent/40 bg-panel px-[clamp(0.6rem,1.5vw,0.9rem)] py-[calc(clamp(0.2rem,0.9dvh,0.45rem)+1px)] font-display text-[clamp(0.85rem,min(2vw,2.8dvh),1.15rem)] font-bold tracking-widest whitespace-nowrap text-paper uppercase transition-colors hover:border-accent"
          >
            <HomeIcon />
            <span className="hidden sm:inline">Home</span>
          </Link>
          {auth.available && (
            <AccountButton
              ready={auth.ready}
              profile={auth.profile}
              saveStatus={saveStatus}
              isAdmin={auth.isAdmin}
              onSignIn={signIn}
              onSignOut={() => void auth.signOut()}
            />
          )}
        </div>

        <div className="flex items-stretch gap-3 justify-self-end xl:col-start-3 xl:row-start-1">
          <div
            role="tablist"
            aria-label="Event sections"
            className="shadow-offset flex overflow-hidden rounded-xl border border-accent/40 bg-panel"
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
                  className={`cursor-pointer px-[clamp(0.75rem,1.6vw,1.1rem)] py-[calc(clamp(0.2rem,0.9dvh,0.45rem)+1px)] font-display text-[clamp(0.85rem,min(2vw,2.8dvh),1.15rem)] font-bold tracking-widest whitespace-nowrap uppercase transition-colors not-last:border-r not-last:border-accent/20 ${
                    selected
                      ? "bg-card-hover text-paper shadow-[inset_0_-3px_0_0_#1d9e75]"
                      : "text-paper/50 hover:text-paper"
                  }`}
                >
                  {"shortLabel" in item ? (
                    <>
                      <span className="sm:hidden">{item.shortLabel}</span>
                      <span className="hidden sm:inline">{item.label}</span>
                    </>
                  ) : (
                    item.label
                  )}
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
        className="flex min-h-0 w-full flex-1 flex-col items-center gap-[clamp(0.4rem,1.5dvh,0.9rem)]"
      >
        {/* The board fills the space above "Copy image". Positioned absolutely so
            its height is fixed for the boards inside (Safari doesn't pass a
            flex-sized height down two levels of flex boxes). */}
        <div className="relative min-h-0 w-full flex-1">
          <div className="absolute inset-0 flex justify-center">
            {section === "tier-list" ? (
              <TierList
                teams={event.teams}
                placements={placements}
                onChange={changePlacements}
              />
            ) : section === "leaderboard" ? (
              <Leaderboard
                leaderboard={leaderboard}
                teams={event.teams}
                currentUserId={userId}
                groupDeadline={groupDeadline}
                playoffsDeadline={playoffsDeadline}
                now={now}
              />
            ) : (
              <Pickems
                event={event}
                data={pickemData}
                state={pickems}
                onChange={changePickems}
                locked={locked}
                deadlines={{ group: groupDeadline, playoffs: playoffsDeadline }}
              />
            )}
          </div>
        </div>

        {copyButton}
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

/** The one status worth showing when several things save independently. */
function combineStatus(statuses: SaveStatus[]): SaveStatus {
  for (const wanted of ["error", "saving", "pending", "saved"] as const) {
    if (statuses.includes(wanted)) return wanted;
  }
  return "idle";
}

type Stash = {
  placements: Placements;
  groupSlots: Slots;
  bracketPicks: BracketPicks;
};

/** Keeps picks through the Twitch sign-in redirect (this browser tab only). */
function putStash(eventId: string, stash: Stash) {
  try {
    sessionStorage.setItem(
      `picks-before-sign-in:${eventId}`,
      JSON.stringify(stash),
    );
  } catch {
    // Storage blocked (private mode etc.): the picks are simply not carried over.
  }
}

function takeStash(eventId: string): Stash | null {
  try {
    const key = `picks-before-sign-in:${eventId}`;
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return raw ? (JSON.parse(raw) as Stash) : null;
  } catch {
    return null;
  }
}
