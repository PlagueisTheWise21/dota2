import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/logo?url=<teams.logo_url>
 *
 * Serves a team logo from this site's own address. Browsers only let a page
 * read the pixels of same-site images, which lib/logo-trim.ts needs to trim
 * empty margins and "Copy image" needs to draw the tier list.
 *
 * Only URLs that appear in `teams.logo_url` are fetched, so this cannot be
 * used to load arbitrary websites.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return new Response("Missing or invalid url", { status: 400 });
  }

  if (!supabase) {
    return new Response("Supabase is not configured", { status: 500 });
  }

  // Supabase table: `teams`, column read: `logo_url`
  const { data, error } = await supabase
    .from("teams")
    .select("logo_url")
    .eq("logo_url", url)
    .limit(1);

  if (error) {
    console.error("Logo lookup failed:", error.message);
    return new Response("Lookup failed", { status: 502 });
  }
  if (!data || data.length === 0) {
    return new Response("Not a team logo", { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Some image hosts (e.g. Wikimedia) reject requests without one.
      headers: { "User-Agent": "dota2-predictions-logo-proxy/1.0" },
    });
  } catch {
    return new Response("Logo could not be fetched", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.startsWith("image/")) {
    return new Response("Logo could not be fetched", { status: 502 });
  }

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) {
    return new Response("Logo too large", { status: 502 });
  }

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      // Browsers and any CDN in front of the site keep it for a day.
      "Cache-Control":
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      // Logos may be SVGs; stop any script inside one from running here.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
