"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { useCardDrag } from "@/components/useCardDrag";
import type { EventTeam } from "@/lib/events";
import {
  BASE,
  BOX_BORDER,
  computeTierLayout,
  type TierLayout,
} from "@/lib/tier-layout";

export const TIERS = [
  { id: "S", color: "#ef4444" },
  { id: "A", color: "#f97316" },
  { id: "B", color: "#eab308" },
  { id: "C", color: "#22c55e" },
  { id: "F", color: "#8b5cf6" },
] as const;

export type TierId = (typeof TIERS)[number]["id"] | "unranked";

/** Team ids in display order, per tier. */
export type Placements = Record<TierId, string[]>;

/** Every team starts in Unranked, in the order given (seed order). */
export function initialPlacements(teams: EventTeam[]): Placements {
  return {
    S: [],
    A: [],
    B: [],
    C: [],
    F: [],
    unranked: teams.map((team) => team.id),
  };
}

/** Moves a team to `index` within `tier` (index counts without the team). */
function moveTeam(
  placements: Placements,
  teamId: string,
  tier: TierId,
  index: number,
): Placements {
  const next = Object.fromEntries(
    Object.entries(placements).map(([id, teamIds]) => [
      id,
      teamIds.filter((other) => other !== teamId),
    ]),
  ) as Placements;
  next[tier].splice(index, 0, teamId);
  return next;
}

type DropTarget = {
  tier: TierId;
  index: number;
  /** Where to draw the insertion marker, in viewport px. */
  marker: { left: number; top: number; height: number };
};

/**
 * Finds the tier and insertion index under the pointer.
 * Rows are marked with data-tier-drop, their card areas with data-cards and
 * cards with data-team-id.
 */
function findDropTarget(
  x: number,
  y: number,
  draggedId: string,
  scale: number,
): DropTarget | null {
  const row = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-tier-drop]");
  if (!row) return null;

  const tier = row.dataset.tierDrop as TierId;
  const cards = Array.from(
    row.querySelectorAll<HTMLElement>("[data-team-id]"),
  ).filter((card) => card.dataset.teamId !== draggedId);
  const halfGap = (BASE.gap * scale) / 2;

  for (let index = 0; index < cards.length; index++) {
    const rect = cards[index].getBoundingClientRect();
    const beforeThisLine = y < rect.top;
    const leftHalfOnThisLine =
      y <= rect.bottom && x < rect.left + rect.width / 2;
    if (beforeThisLine || leftHalfOnThisLine) {
      return {
        tier,
        index,
        marker: { left: rect.left - halfGap, top: rect.top, height: rect.height },
      };
    }
  }

  const last = cards.at(-1)?.getBoundingClientRect();
  if (last) {
    return {
      tier,
      index: cards.length,
      marker: { left: last.right + halfGap, top: last.top, height: last.height },
    };
  }

  const area = row.querySelector<HTMLElement>("[data-cards]");
  const areaRect = (area ?? row).getBoundingClientRect();
  return {
    tier,
    index: 0,
    marker: {
      left: areaRect.left + BASE.pad * scale - halfGap,
      top: areaRect.top + BASE.pad * scale,
      height: BASE.cardHeight * scale,
    },
  };
}

type TierListProps = {
  teams: EventTeam[];
  placements: Placements;
  onChange: (placements: Placements) => void;
};

/**
 * Drag-and-drop tier list (S, A, B, C, F and Unranked).
 * Fills its parent and sizes itself so nothing needs scrolling; see
 * lib/tier-layout.ts. Width and card size stay fixed while teams move;
 * only the row heights change. Works with mouse, pen and touch.
 */
export function TierList({ teams, placements, onChange }: TierListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  const teamsById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );

  // Track the space available to the board. Measured once before the first
  // paint so the board does not flash empty, then on every resize.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    setSize({ width, height });
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Depends only on the team count and the space, so the board keeps its
  // width and card size while teams are moved around.
  const layout: TierLayout | null = size
    ? computeTierLayout(size.width, size.height, teams.length)
    : null;
  const scale = layout?.scale ?? 1;

  const { drag, startDrag } = useCardDrag<DropTarget>({
    findTarget: (x, y, teamId) => findDropTarget(x, y, teamId, scale),
    onDrop: (teamId, target) =>
      onChange(moveTeam(placements, teamId, target.tier, target.index)),
  });

  if (teams.length === 0) {
    return (
      <p className="self-start rounded-xl border border-accent/30 bg-panel px-6 py-4 text-center text-sm text-paper/80">
        No teams have been added to this event yet.
      </p>
    );
  }

  const draggedTeam = drag ? teamsById.get(drag.teamId) : undefined;

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full justify-center select-none ${
        layout?.fits === false ? "overflow-y-auto" : "overflow-hidden"
      } ${drag ? "cursor-grabbing" : ""}`}
    >
      {layout && (
        <TierBoard
          teamsById={teamsById}
          placements={placements}
          scale={scale}
          width={layout.width}
          draggedId={drag?.teamId ?? null}
          onCardPointerDown={startDrag}
        />
      )}

      {drag?.target && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 w-[3px] -translate-x-1/2 bg-paper shadow-[0_0_6px_rgba(232,236,241,0.8)]"
          style={{
            left: drag.target.marker.left,
            top: drag.target.marker.top,
            height: drag.target.marker.height,
          }}
        />
      )}

      {drag && draggedTeam && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rotate-2"
          style={{ left: drag.x - drag.offsetX, top: drag.y - drag.offsetY }}
        >
          <TierCard team={draggedTeam} scale={scale} lifted />
        </div>
      )}
    </div>
  );
}

type TierBoardProps = {
  teamsById: Map<string, EventTeam>;
  placements: Placements;
  scale: number;
  /** Board width in px. */
  width: number;
  /** Team being dragged; its card is dimmed in place. */
  draggedId?: string | null;
  /** Called when a card is pressed, to start dragging it. */
  onCardPointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    teamId: string,
  ) => void;
};

/**
 * The tiers box and the Unranked box. lib/tier-image.ts draws the same
 * layout for "Copy image"; keep the two in step when changing the look.
 */
function TierBoard({
  teamsById,
  placements,
  scale,
  width,
  draggedId = null,
  onCardPointerDown,
}: TierBoardProps) {
  const boxStyle: CSSProperties = { borderWidth: BOX_BORDER };

  function renderRow(tier: TierId, label: ReactNode, color: string) {
    return (
      <div
        key={tier}
        data-tier-drop={tier}
        className="flex border-ink not-last:border-b-2"
        style={{ minHeight: BASE.rowMinHeight * scale }}
      >
        <div
          className="flex shrink-0 items-center justify-center border-r-2 border-ink"
          style={{ width: BASE.label * scale, backgroundColor: color }}
        >
          {label}
        </div>
        <ul
          data-cards
          className="flex min-w-0 flex-1 flex-wrap content-start bg-panel"
          style={{ gap: BASE.gap * scale, padding: BASE.pad * scale }}
        >
          {placements[tier].map((teamId) => {
            const team = teamsById.get(teamId);
            if (!team) return null;
            return (
              <li key={teamId} data-team-id={teamId}>
                <TierCard
                  team={team}
                  scale={scale}
                  dimmed={draggedId === teamId}
                  onPointerDown={(event) => onCardPointerDown(event, teamId)}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col self-start" style={{ width }}>
      <div className="shadow-offset overflow-hidden rounded-xl border-ink" style={boxStyle}>
        {TIERS.map((tier) =>
          renderRow(
            tier.id,
            <span
              className="font-display leading-none font-bold text-black"
              style={{ fontSize: 30 * scale }}
            >
              {tier.id}
            </span>,
            tier.color,
          ),
        )}
      </div>

      <div
        className="shadow-offset overflow-hidden rounded-xl border-ink"
        style={{ ...boxStyle, marginTop: BASE.sectionGap * scale }}
      >
        {renderRow(
          "unranked",
          <span
            className="font-display font-bold tracking-widest text-paper uppercase [writing-mode:vertical-rl] rotate-180"
            style={{ fontSize: Math.max(10, 13 * scale) }}
          >
            Unranked
          </span>,
          "#15363c",
        )}
      </div>
    </div>
  );
}

type TierCardProps = {
  team: EventTeam;
  scale: number;
  /** The card's original spot while it is being dragged. */
  dimmed?: boolean;
  /** The copy that follows the pointer. */
  lifted?: boolean;
  /** Makes the card draggable. */
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
};

/**
 * A draggable team box: logo on top (most of the card), name underneath on
 * one line; the full name shows on hover. Dark box with a light outline and
 * light text, matching the predictions board (lib/tier-image.ts draws the
 * same look for "Copy image").
 */
function TierCard({ team, scale, dimmed, lifted, onPointerDown }: TierCardProps) {
  const interactive = Boolean(onPointerDown);

  return (
    <div
      onPointerDown={onPointerDown}
      title={team.name}
      className={`flex flex-col overflow-hidden rounded-md border bg-card text-paper ${
        lifted
          ? "border-accent shadow-xl shadow-black/60"
          : "border-accent/40 shadow-md shadow-black/40"
      } ${
        interactive ? "cursor-grab touch-none transition-colors hover:border-accent" : ""
      } ${dimmed ? "opacity-30" : ""}`}
      style={{ width: BASE.cardWidth * scale, height: BASE.cardHeight * scale }}
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ height: BASE.logoArea * scale, padding: BASE.logoPad * scale }}
      >
        <TeamLogo team={team} fallbackStyle={{ fontSize: 18 * scale }} />
      </div>
      <p
        className="flex min-h-0 flex-1 items-center justify-center border-t border-accent/20 leading-none font-semibold"
        style={{
          fontSize: Math.max(8, BASE.nameFont * scale),
          paddingInline: 3 * scale,
        }}
      >
        <span className="min-w-0 truncate">{team.name}</span>
      </p>
    </div>
  );
}
