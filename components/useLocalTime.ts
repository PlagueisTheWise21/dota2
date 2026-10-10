"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Times in the visitor's own timezone (e.g. "22 Oct, 09:00 BST").
 *
 * The server can't know the visitor's timezone, so the page is first drawn
 * in UTC ("22 Oct, 08:00 UTC") and switches to local time as soon as it runs
 * in the browser. useSyncExternalStore does that without a hydration mismatch.
 */

const subscribe = () => () => {};

export function formatTime(iso: string, local: boolean): string {
  const date = new Date(iso);
  const parts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  if (!local) return `${new Intl.DateTimeFormat("en-GB", { ...parts, timeZone: "UTC" }).format(date)} UTC`;
  return new Intl.DateTimeFormat(undefined, { ...parts, timeZoneName: "short" }).format(date);
}

/** A formatter for deadlines: UTC on the server, local time in the browser. */
export function useFormatTime(): (iso: string) => string {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return useCallback((iso: string) => formatTime(iso, inBrowser), [inBrowser]);
}
