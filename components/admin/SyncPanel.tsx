"use client";

import { useEffect, useState } from "react";
import { Button, errorText, Field, formatUtc, TextInput } from "@/components/admin/ui";
import { loadEventSyncInfo, runSync, updateEvent, type AdminEvent, type SyncResult } from "@/lib/admin";

/**
 * Runs the Liquipedia sync from the admin page (on the server, see
 * app/api/admin/sync/route.ts). With an event it syncs that event; without
 * one it imports a new event from a Liquipedia page.
 */
export function SyncPanel({
  event,
  reload,
  onImported,
}: {
  event: AdminEvent | null;
  reload: () => Promise<void>;
  onImported?: (eventId: string) => void;
}) {
  const [page, setPage] = useState(event?.liquipedia_page ?? "");
  const [running, setRunning] = useState<"preview" | "sync" | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(event?.auto_sync ?? false);
  const [autoSyncError, setAutoSyncError] = useState<string | null>(null);

  async function changeAutoSync(on: boolean) {
    if (!event) return;
    setAutoSync(on);
    setAutoSyncError(null);
    try {
      await updateEvent(event.id, { auto_sync: on });
      await reload();
    } catch (reason) {
      setAutoSync(!on);
      setAutoSyncError(errorText(reason));
    }
  }

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    loadEventSyncInfo(event.id)
      .then((info) => !cancelled && setLastSynced(info.lastSynced))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [event]);

  async function run(dryRun: boolean) {
    setRunning(dryRun ? "preview" : "sync");
    setResult(null);
    try {
      const outcome = await runSync(page, event?.id ?? null, dryRun);
      setResult(outcome);
      if (outcome.ok && !dryRun) {
        await reload();
        if (event) setLastSynced((await loadEventSyncInfo(event.id)).lastSynced);
        if (!event && outcome.eventId) onImported?.(outcome.eventId);
      }
    } catch (reason) {
      setResult({ ok: false, error: errorText(reason), log: [] });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Field label="Liquipedia page" hint="e.g. PGL/Wallachia/9 or the full liquipedia.net link">
            <TextInput value={page} onChange={(e) => setPage(e.target.value)} placeholder="PARI_Universe/1" />
          </Field>
        </div>
        <Button onClick={() => void run(true)} disabled={!page.trim() || running !== null}>
          {running === "preview" ? "Checking..." : "Preview changes"}
        </Button>
        <Button variant="primary" onClick={() => void run(false)} disabled={!page.trim() || running !== null}>
          {running === "sync" ? "Syncing..." : event ? "Sync now" : "Import event"}
        </Button>
      </div>

      <p className="text-xs text-paper/50">
        {event && <>Last synced: {formatUtc(event.last_synced_at ?? lastSynced)}. </>}
        Each preview or sync uses 4 of Liquipedia&apos;s 60 requests an hour. Syncing updates the
        teams, matches, group tables and placements{event ? " and links this event to the page" : ""}.
      </p>

      {event && (
        <div className="flex flex-col gap-1 border-t border-paper/20 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => void changeAutoSync(e.target.checked)}
              className="h-4 w-4 accent-[#e8ecf1]"
            />
            Sync automatically while the event is live
          </label>
          <p className="text-xs text-paper/50">
            When someone opens the event page, it re-syncs in the background if the last sync was
            over 30 minutes ago (from a day before the start to a day after the end). Needs a
            Liquipedia page.
          </p>
          {autoSyncError && <p className="text-sm text-[#f87171]">{autoSyncError}</p>}
        </div>
      )}

      {result && (
        <div
          className={`border px-3 py-2 text-sm ${
            result.ok ? "border-[#4ade80]/50 bg-[#0f1f14]" : "border-[#ef4444]/60 bg-[#2a1414]"
          }`}
        >
          {!result.ok && <p className="mb-1 font-semibold text-[#fca5a5]">{result.error}</p>}
          {result.log.length > 0 && (
            <pre className="max-h-80 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-paper/80">
              {result.log.join("\n")}
            </pre>
          )}
          {result.ok && (result.createdTeams?.length ?? 0) > 0 && (
            <p className="mt-2 text-[#facc15]">
              New teams without logos: {result.createdTeams!.join(", ")}. Add their logos under Teams.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
