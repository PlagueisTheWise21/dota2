"use client";

import { useMemo, type ReactNode } from "react";
import { TeamChip, type PickResult } from "@/components/TeamChip";
import { useCardDrag } from "@/components/useCardDrag";
import type { EventTeam } from "@/lib/events";

/** Team id in each slot, or null for an empty slot. */
export type Slots = (string | null)[];

export type SlotGroup = {
  /** "3–0", "Advance" */
  label: string;
  /** Second label line, e.g. "3–1 / 3–2". */
  sublabel?: string;
  /** Number of slots in the group. */
  size: number;
  /** Label background; dark grey when left out. */
  color?: string;
};

type DropTarget = { kind: "slot"; index: number } | { kind: "pool" };

/**
 * Puts a team in a slot or back in the pool. Dropping on a filled slot
 * swaps: the team already there moves to where the dragged team came from
 * (the pool, if it came from there).
 */
function dropTeam(slots: Slots, teamId: string, target: DropTarget): Slots {
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

/** Height of the header row, in px. */
const HEADER_HEIGHT = 30;
/** Tallest a row gets on big screens, in px. */
const MAX_ROW_HEIGHT = 40;
/** Rows never get shorter than this; below it the board scrolls. */
const MIN_ROW_HEIGHT = 20;

type SlotBoardProps = {
  teams: EventTeam[];
  groups: SlotGroup[];
  slots: Slots;
  onChange: (slots: Slots) => void;
  /** Header of the slot column, e.g. "Pick". */
  slotsTitle: string;
  /** Right or wrong for a filled slot, once the real result is known. */
  resultFor?: (index: number, teamId: string) => PickResult | null;
  /** Small text at the bottom of the teams box. */
  footer?: ReactNode;
  /** Picks are locked: show them, but nothing can be dragged. */
  readOnly?: boolean;
};

/**
 * Drag-and-drop board: labelled groups of slots on the left, the teams not
 * yet placed on the right. Used by the group stage pick'em. Fills its parent
 * and keeps every row the same height so both columns line up.
 */
export function SlotBoard({
  teams,
  groups,
  slots,
  onChange,
  slotsTitle,
  resultFor,
  footer,
  readOnly = false,
}: SlotBoardProps) {
  const teamsById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );

  const { drag, startDrag } = useCardDrag<DropTarget>({
    findTarget: (x, y) => findDropTarget(x, y),
    onDrop: (teamId, target) => onChange(dropTeam(slots, teamId, target)),
  });

  const placed = new Set(slots.filter((id): id is string => id !== null));
  const pool = teams.filter((team) => !placed.has(team.id));
  const draggedTeam = drag ? teamsById.get(drag.teamId) : undefined;

  // Both columns share one row height, set by the taller column.
  const slotCount = slots.length;
  const rowCount = Math.max(slotCount, teams.length);
  const rowsCss = (count: number) =>
    `${HEADER_HEIGHT}px repeat(${count}, minmax(${MIN_ROW_HEIGHT}px, 1fr))`;
  const boardMaxHeight = HEADER_HEIGHT + rowCount * MAX_ROW_HEIGHT + 6;
  const shareOfHeight = (count: number) =>
    `calc(${HEADER_HEIGHT + 6}px + (100% - ${HEADER_HEIGHT + 6}px) * ${count / rowCount})`;

  function chip(team: EventTeam, result?: PickResult | null) {
    return (
      <TeamChip
        team={team}
        result={result}
        dimmed={drag?.teamId === team.id}
        onPointerDown={readOnly ? undefined : (event) => startDrag(event, team.id)}
      />
    );
  }

  // Index of each group's first slot.
  const groupStarts = groups.map((_, index) =>
    groups.slice(0, index).reduce((sum, group) => sum + group.size, 0),
  );

  return (
    <div
      className={`flex h-full w-full justify-center overflow-y-auto select-none ${
        drag ? "cursor-grabbing" : ""
      }`}
    >
      <div
        className="flex h-full w-full max-w-[760px] items-start gap-[clamp(0.5rem,2vw,1.25rem)]"
        style={{ maxHeight: boardMaxHeight }}
      >
        {/* Slots */}
        <div
          className="shadow-offset grid min-w-0 flex-[1.4] overflow-hidden rounded-xl border border-accent/30 bg-panel"
          style={{
            gridTemplateColumns: "clamp(3.25rem, 9vw, 5rem) 1fr",
            gridTemplateRows: rowsCss(slotCount),
            height: shareOfHeight(slotCount),
          }}
        >
          <HeaderCell className="border-r-2">Result</HeaderCell>
          <HeaderCell>{slotsTitle}</HeaderCell>

          {groups.map((group, groupIndex) => {
            const lastGroup = groupIndex === groups.length - 1;
            return [
              <div
                key={`label-${group.label}`}
                className={`flex flex-col items-center justify-center border-r-2 border-ink px-1 text-center leading-tight ${
                  group.color ? "text-black" : "bg-card-hover text-paper"
                } ${lastGroup ? "" : "border-b-2"}`}
                style={{
                  gridColumn: 1,
                  gridRow: `span ${group.size}`,
                  backgroundColor: group.color,
                }}
              >
                <span className="font-display text-[clamp(0.85rem,2.2dvh,1.15rem)] font-bold">
                  {group.label}
                </span>
                {group.sublabel && (
                  <span className="text-[0.65rem] font-semibold opacity-80">{group.sublabel}</span>
                )}
              </div>,
              ...Array.from({ length: group.size }, (_, offset) => {
                const index = groupStarts[groupIndex] + offset;
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
                    className={`min-h-0 border-ink p-[3px] transition-colors ${
                      lastInGroup
                        ? lastGroup
                          ? ""
                          : "border-b-2"
                        : "border-b border-b-black/60"
                    } ${isTarget ? "bg-white/15" : ""}`}
                  >
                    {team ? (
                      chip(team, resultFor?.(index, team.id))
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
          className={`shadow-offset grid min-w-0 flex-1 content-start overflow-hidden rounded-xl border border-accent/30 transition-colors ${
            drag?.target?.kind === "pool" ? "bg-[#222]" : "bg-panel"
          }`}
          style={{ gridTemplateRows: rowsCss(teams.length), height: shareOfHeight(teams.length) }}
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

          {footer && pool.length < teams.length && (
            <div
              className="flex items-end justify-center px-2 pb-2 text-center text-[0.7rem] text-paper/50"
              style={{ gridRow: `${pool.length + 2} / -1` }}
            >
              {footer}
            </div>
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
      className={`flex items-center border-b-2 border-ink bg-card-hover px-2 font-display text-xs font-bold tracking-widest text-paper/70 uppercase ${className}`}
    >
      {children}
    </div>
  );
}
