"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Saves the latest value shortly after the last change, so dragging several
 * teams in a row makes one save, not one per drag. Call `schedule` from the
 * code that handles a user's change (not when loading saved data).
 */
export function useDebouncedSave<T>(save: (value: T) => Promise<void>, delayMs = 600) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const schedule = useCallback(
    (value: T) => {
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setStatus("saving");
        try {
          await saveRef.current(value);
          setStatus("saved");
        } catch (error) {
          console.error("Saving failed:", error);
          setStatus("error");
        }
      }, delayMs);
    },
    [delayMs],
  );

  return { status, schedule };
}
