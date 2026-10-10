"use client";

import { useFormatTime } from "@/components/useLocalTime";

/** Show the reminder when picks lock within this long. */
export const REMIND_WITHIN_MS = 48 * 60 * 60 * 1000;

/** "1d 4h", "3h 20m", "12m", "under a minute". */
function timeLeft(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * A strip above the board when a stage's picks lock soon, counting down
 * (updates every 30 s with useNow). Signed-out visitors are asked to sign in
 * so their picks are kept.
 */
export function DeadlineReminder({
  stage,
  deadline,
  now,
  signedIn,
  onSignIn,
}: {
  stage: "Group stage" | "Playoff";
  deadline: string;
  now: number;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const formatTime = useFormatTime();
  const left = Date.parse(deadline) - now;
  const urgent = left < 2 * 60 * 60 * 1000;
  return (
    <div
      role="status"
      className={`flex w-full max-w-[760px] shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border px-3 py-1.5 text-center text-xs sm:text-sm ${
        urgent ? "border-[#ef4444]/60 bg-[#2a1414]/90 text-[#fecaca]" : "border-accent/50 bg-panel/90 text-paper"
      }`}
    >
      <span>
        <span aria-hidden="true">⏳ </span>
        {stage} picks lock in <strong>{timeLeft(left)}</strong>
        <span className="text-muted/70"> · {formatTime(deadline)}</span>
      </span>
      {!signedIn && (
        <button
          type="button"
          onClick={onSignIn}
          className="cursor-pointer rounded-md bg-accent-strong px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-accent"
        >
          Sign in to save your picks
        </button>
      )}
    </div>
  );
}
