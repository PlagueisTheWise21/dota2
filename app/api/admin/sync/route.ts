import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { fetchLiquipedia, normalisePage, syncTournament } from "@/lib/liquipedia-sync.mjs";

/**
 * POST /api/admin/sync  { page, eventId?, dryRun? }
 *
 * The admin page's "Sync from Liquipedia" button. The browser sends the
 * signed-in person's access token; only admins (public.is_admin()) get
 * through. The sync itself runs here on the server with the service role key
 * and the Liquipedia key, which never reach the browser.
 *
 * Needs (server only, never NEXT_PUBLIC_): LIQUIPEDIA_API_KEY and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local, and in Vercel's environment variables.
 * Each run makes 4 Liquipedia requests (the API allows 60 an hour).
 */

// A sync makes a few slow requests; give it room.
export const maxDuration = 60;

const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return Response.json({ ok: false, error: message, log: [] }, { status });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const liquipediaKey = process.env.LIQUIPEDIA_API_KEY;
  if (!supabaseUrl || !PUBLIC_KEY) return fail("Supabase is not configured.", 500);

  // Who is asking: check their token by asking the database if they are an admin.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("Sign in first.", 401);
  const asCaller = createClient(supabaseUrl, PUBLIC_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isAdmin, error: adminError } = await asCaller.rpc("is_admin");
  if (adminError || isAdmin !== true) return fail("Only admins can sync.", 403);

  if (!serviceKey || !liquipediaKey) {
    return fail(
      "The server is missing SUPABASE_SERVICE_ROLE_KEY or LIQUIPEDIA_API_KEY (add them to Vercel's environment variables).",
      500,
    );
  }

  let body: { page?: unknown; eventId?: unknown; dryRun?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Bad request.", 400);
  }
  const page = typeof body.page === "string" ? normalisePage(body.page.trim()) : "";
  if (!page || page.length > 200) return fail("Enter the Liquipedia page, e.g. PGL/Wallachia/9.", 400);
  const eventId = typeof body.eventId === "string" && UUID_PATTERN.test(body.eventId) ? body.eventId : null;
  const dryRun = body.dryRun === true;

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const log: string[] = [];
  try {
    const result = await syncTournament({
      db,
      pageName: page,
      eventId,
      dryRun,
      loadDataset: async (_name, query) =>
        JSON.parse(await fetchLiquipedia(liquipediaKey, query)).result,
      log: (line: string) => log.push(line),
    });
    log.push(dryRun ? "Preview only: nothing was written." : "Done.");
    // Show the new data on the (cached) homepage and event pages straight away.
    if (!dryRun) revalidatePath("/", "layout");
    return Response.json({ ok: true, eventId: dryRun ? null : result.eventId, createdTeams: result.createdTeams, log });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    return Response.json({ ok: false, error: message, log }, { status: 502 });
  }
}
