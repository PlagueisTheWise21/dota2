"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import type { EventTeam } from "@/lib/events";

export type PickResult = "correct" | "wrong";

type TeamChipProps = {
  team: EventTeam;
  /** The chip's original spot while it is being dragged. */
  dimmed?: boolean;
  /** The copy that follows the pointer. */
  lifted?: boolean;
  /** Green or red outline once the real result is known. */
  result?: PickResult | null;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
};

/**
 * A draggable team row: logo square on the left, name on the right.
 * Dark box with a light outline and light text.
 */
export function TeamChip({ team, dimmed, lifted, result, onPointerDown }: TeamChipProps) {
  const outline =
    result === "correct"
      ? "border-[#22c55e]"
      : result === "wrong"
        ? "border-[#ef4444]"
        : lifted
          ? "border-paper"
          : "border-paper/60 hover:border-paper";

  return (
    <div
      onPointerDown={onPointerDown}
      title={result ? `${team.name} (${result === "correct" ? "correct" : "wrong"})` : team.name}
      className={`flex h-full items-stretch overflow-hidden border bg-[#202020] text-paper ${outline} ${
        lifted
          ? "shadow-[5px_5px_0_0_rgba(0,0,0,0.9)]"
          : `shadow-[2px_2px_0_0_#000] transition-colors ${onPointerDown ? "cursor-grab touch-none" : ""}`
      } ${dimmed ? "opacity-30" : ""}`}
    >
      <div className="flex aspect-square h-full shrink-0 items-center justify-center border-r border-paper/30 p-[2px]">
        <TeamLogo team={team} fallbackStyle={{ fontSize: "0.6rem" }} />
      </div>
      <span className="flex min-w-0 flex-1 items-center px-2 text-[clamp(0.7rem,1.7dvh,0.9rem)] font-semibold">
        <span className="truncate">{team.name}</span>
      </span>
      {result && (
        <span
          aria-hidden="true"
          className={`flex shrink-0 items-center pr-2 text-sm font-bold ${
            result === "correct" ? "text-[#22c55e]" : "text-[#ef4444]"
          }`}
        >
          {result === "correct" ? "✓" : "✗"}
        </span>
      )}
    </div>
  );
}
