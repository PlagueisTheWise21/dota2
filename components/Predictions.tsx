"use client";

import {
  useMemo,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { TeamLogo } from "@/components/TeamLogo";
import { useCardDrag } from "@/components/useCardDrag";
import type { EventTeam } from "@/lib/events";
import { placementGroups } from "@/lib/placements";

/**
 * Team id in each final-standings slot (index 0 = 1st place), or null for
 * an empty slot. One slot per team in the event.
 */
export type PredictionSlots = (string | null)[];

export function emptyPrediction(teams: EventTeam[]): PredictionSlots {
  return teams.map(() => null);
}

type DropTarget = { kind: "slot"; index: number } | { kind: "pool" };

/**
 * Puts a team in a slot or back in the pool. Dropping on a filled slot
 * swaps: the team already there moves to where the dragged team came from
 * (the pool, if it came from there).
 */
function dropTeam(
  slots: PredictionSlots,
  teamId: string,
  target: DropTarget,
): PredictionSlots {
  const next = [...slots];
  const from = next.indexOf(teamId); // -1 when coming from the pool

  if (target.kind === "pool") {
    if (from >= 0) next[from] = null;
    return next;
  }

  if (from === target.index) return slots;
  const occupant = next[target.index];
  next[target.index] = teamId;
  if (from >= 0) next[from] = occupant;
  return next;
}

function findDropTarget(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  const slot = element?.closest<HTMLElement>("[data-slot]");
  if (slot) return { kind: "slot", index: Number(slot.dataset.slot) };
  if (element?.closest("[data-pool]")) return { kind: "pool" };
  return null;
}

/** Medal colours for the top three, like Liquipedia (also lib/prediction-image.ts). */
export const PLACE_COLORS: Record<number, string> = {
  0: "#d4a72c",
  1: "#a9b4bf",
  2: "#b5793f",
};

/** Height of the header row, in px. */
const HEADER_HEIGHT = 30;
/** Tallest a row gets on big screens, in px. */
const MAX_ROW_HEIGHT = 40;
/** Rows never get shorter than this; below it the board scrolls. */
const MIN_ROW_HEIGHT = 20;

type PredictionsProps = {
  teams: EventTeam[];
  slots: PredictionSlots;
  onChange: (slots: PredictionSlots) => void;
  /** events.prediction_deadline (shown only; nothing is locked yet). */
  deadline: string;
};

/**
 * Final-standings prediction board in the style of Liquipedia's placement
 * table: placement groups (1, 2, 3, 4, 5–6, 7–8, 9–12…) on the left, the
 * teams still to place on the right. Teams are dragged into slots.
 * Not saved yet.
 */
export function Predictions({ teams, slots, onChange, deadline }: PredictionsProps) {
  const teamsById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );
  const groups = useMemo(() => placementGroups(teams.length), [teams.length]);

  const { drag, startDrag } = useCardDrag<DropTarget>({
    findTarget: (x, y) => findDropTarget(x, y),
    onDrop: (teamId, target) => onChange(dropTeam(slots, teamId, target)),
  });

  if (teams.length === 0) {
    return (
      <p className="self-start border-2 border-black bg-panel px-6 py-4 text-center text-sm text-paper/80">
        No teams have been added to this event yet.
      </p>
    );
  }

  const placed = new Set(slots.filter((id): id is string => id !== null));
  const pool = teams.filter((team) => !placed.has(team.id));
  const draggedTeam = drag ? teamsById.get(drag.teamId) : undefined;

  const rowCount = teams.length;
  const gridRows = `${HEADER_HEIGHT}px repeat(${rowCount}, minmax(${MIN_ROW_HEIGHT}px, 1fr))`;
  const boardMaxHeight = HEADER_HEIGHT + rowCount * MAX_ROW_HEIGHT + 6;

  function chip(team: EventTeam) {
    return (
      <TeamChip
        team={team}
        dimmed={drag?.teamId === team.id}
        onPointerDown={(event) => startDrag(event, team.id)}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full justify-center overflow-y-auto select-none ${
        drag ? "cursor-grabbing" : ""
      }`}
    >
      <div
        className="flex h-full w-full max-w-[760px] gap-[clamp(0.5rem,2vw,1.25rem)]"
        style={{ maxHeight: boardMaxHeight }}
      >
        {/* Placements */}
        <div
          className="shadow-offset grid min-w-0 flex-[1.4] border-[3px] border-black bg-panel"
          style={{
            gridTemplateColumns: "clamp(2.75rem, 7vw, 4rem) 1fr",
            gridTemplateRows: gridRows,
          }}
        >
          <HeaderCell className="border-r-2">Place</HeaderCell>
          <HeaderCell>Team</HeaderCell>

          {groups.map((group, groupIndex) => {
            const medal = PLACE_COLORS[groupIndex];
            return [
              <div
                key={`label-${group.label}`}
                className={`flex items-center justify-center border-r-2 border-black font-display text-[clamp(0.85rem,2.2dvh,1.15rem)] font-bold ${
                  medal ? "text-black" : "bg-[#2a2a2a] text-paper"
                } ${groupIndex < groups.length - 1 ? "border-b-2" : ""}`}
                style={{
                  gridColumn: 1,
                  gridRow: `span ${group.size}`,
                  backgroundColor: medal,
                }}
              >
                {group.label}
              </div>,
              ...Array.from({ length: group.size }, (_, offset) => {
                const index = group.start + offset;
                const teamId = slots[index];
                const team = teamId ? teamsById.get(teamId) : undefined;
                const lastInGroup = offset === group.size - 1;
                const isTarget =
                  drag?.target?.kind === "slot" && drag.target.index === index;
                return (
                  <div
                    key={`slot-${index}`}
                    data-slot={index}
                    style={{ gridColumn: 2 }}
                    className={`min-h-0 border-black p-[3px] transition-colors ${
                      lastInGroup
                        ? groupIndex < groups.length - 1
                          ? "border-b-2"
                          : ""
                        : "border-b border-b-black/60"
                    } ${isTarget ? "bg-white/15" : ""}`}
                  >
                    {team ? (
                      chip(team)
                    ) : (
                      <div className="h-full border border-dashed border-white/10" />
                    )}
                  </div>
                );
              }),
            ];
          })}
        </div>

        {/* Teams still to place */}
        <div
          data-pool
          className={`shadow-offset grid min-w-0 flex-1 content-start border-[3px] border-black transition-colors ${
            drag?.target?.kind === "pool" ? "bg-[#222]" : "bg-panel"
          }`}
          style={{ gridTemplateRows: gridRows }}
        >
          <HeaderCell>
            <span>Teams</span>
            <span className="ml-auto font-sans text-[0.7rem] font-medium tracking-normal normal-case text-paper/50">
              {pool.length > 0 ? `${pool.length} left` : "All placed"}
            </span>
          </HeaderCell>

          {pool.map((team) => (
            <div key={team.id} className="min-h-0 p-[3px]">
              {chip(team)}
            </div>
          ))}

          {pool.length < rowCount && (
            <p
              className="flex items-end justify-center px-2 pb-2 text-center text-[0.7rem] text-paper/40"
              style={{ gridRow: `${pool.length + 2} / -1` }}
            >
              Predictions close {formatDeadline(deadline)}
            </p>
          )}
        </div>
      </div>

      {drag && draggedTeam && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rotate-1"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            width: drag.width,
            height: drag.height,
          }}
        >
          <TeamChip team={draggedTeam} lifted />
        </div>
      )}
    </div>
  );
}

function HeaderCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center border-b-2 border-black bg-[#2a2a2a] px-2 font-display text-xs font-bold tracking-widest text-paper/70 uppercase ${className}`}
    >
      {children}
    </div>
  );
}

type TeamChipProps = {
  team: EventTeam;
  /** The chip's original spot while it is being dragged. */
  dimmed?: boolean;
  /** The copy that follows the pointer. */
  lifted?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
};

/**
 * A draggable team row: logo square on the left, name on the right.
 * Dark box with a light outline and light text.
 */
function TeamChip({ team, dimmed, lifted, onPointerDown }: TeamChipProps) {
  return (
    <div
      onPointerDown={onPointerDown}
      title={team.name}
      className={`flex h-full items-stretch overflow-hidden border bg-[#202020] text-paper ${
        lifted
          ? "border-paper shadow-[5px_5px_0_0_rgba(0,0,0,0.9)]"
          : "cursor-grab touch-none border-paper/60 shadow-[2px_2px_0_0_#000] transition-colors hover:border-paper"
      } ${dimmed ? "opacity-30" : ""}`}
    >
      <div className="flex aspect-square h-full shrink-0 items-center justify-center border-r border-paper/30 p-[2px]">
        <TeamLogo team={team} fallbackStyle={{ fontSize: "0.6rem" }} />
      </div>
      <span className="flex min-w-0 flex-1 items-center px-2 text-[clamp(0.7rem,1.7dvh,0.9rem)] font-semibold">
        <span className="truncate">{team.name}</span>
      </span>
    </div>
  );
}

const deadlineFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "29 Sept 2026, 10:00 UTC" */
function formatDeadline(deadline: string): string {
  return `${deadlineFormat.format(new Date(deadline))} UTC`;
}
