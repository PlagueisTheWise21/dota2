"use client";

import { useSyncExternalStore } from "react";

const STEP_MS = 30_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, STEP_MS);
  return () => clearInterval(timer);
}

/** The current time, rounded down to 30 s so it only changes every 30 s. */
function snapshot(): number {
  return Math.floor(Date.now() / STEP_MS) * STEP_MS;
}

/**
 * The current time in ms, updating every 30 s, so deadlines lock on their
 * own while the page is open. null while server rendering (time unknown).
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
