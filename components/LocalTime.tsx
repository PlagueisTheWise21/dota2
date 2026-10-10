"use client";

import { useFormatTime } from "@/components/useLocalTime";

/** A time shown in the visitor's own timezone (for server-rendered pages). */
export function LocalTime({ iso }: { iso: string }) {
  const format = useFormatTime();
  return <time dateTime={iso}>{format(iso)}</time>;
}
