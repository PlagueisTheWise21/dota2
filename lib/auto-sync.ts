import { createClient } from "@supabase/supabase-js";
import { fetchLiquipedia, syncTournament } from "@/lib/liquipedia-sync.mjs";

/**
 * Automatic Liquipedia sync (server only). The event page calls this after
 * sending the page (next/server `after`), so visitors never wait for it.
 *
 * It syncs only when the event has `auto_sync` on, a Liquipedia page, is
 * live (from a day before its start to a day after its end) and was last
 * synced more than SYNC_EVERY_MINUTES ago. Claiming the event by setting
 * `last_synced_at` in the same update means two visitors at once can't both
 * start a sync. Each sync is 4 Liquipedia requests (the API allows 60 an hour).
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY and LIQUIPEDIA_API_KEY (server only).
 */

const SYNC_EVERY_MINUTES = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function maybeAutoSync(eventId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const liquipediaKey = process.env.LIQUIPEDIA_API_KEY;
  if (!supabaseUrl || !serviceKey || !liquipediaKey) return;

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const now = Date.now();
  const cutoff = new Date(now - SYNC_EVERY_MINUTES * 60 * 1000).toISOString();

  const { data: claimed, error } = await db
    .from("events")
    .update({ last_synced_at: new Date(now).toISOString() })
    .eq("id", eventId)
    .eq("auto_sync", true)
    .not("liquipedia_page", "is", null)
    .lte("start_date", new Date(now + DAY_MS).toISOString())
    .gte("end_date", new Date(now - DAY_MS).toISOString())
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .select("liquipedia_page")
    .maybeSingle();
  if (error || !claimed) return;

  try {
    await syncTournament({
      db,
      pageName: claimed.liquipedia_page,
      eventId,
      loadDataset: async (_name, query) => JSON.parse(await fetchLiquipedia(liquipediaKey, query)).result,
      log: () => undefined,
    });
  } catch (reason) {
    console.error(`Automatic sync of ${claimed.liquipedia_page} failed:`, reason);
  }
}
