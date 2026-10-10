import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

/**
 * POST /api/revalidate
 *
 * Clears the cached homepage and event pages so admin changes show up
 * straight away instead of within the minute (pages are cached; see
 * `revalidate` in app/page.tsx and app/events/[id]/page.tsx). The admin page
 * calls this after every change. Only admins (public.is_admin()) may use it.
 */

const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !PUBLIC_KEY || !token) return Response.json({ ok: false }, { status: 401 });

  const asCaller = createClient(supabaseUrl, PUBLIC_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isAdmin } = await asCaller.rpc("is_admin");
  if (isAdmin !== true) return Response.json({ ok: false }, { status: 403 });

  // Every page under the root layout: the homepage and all event pages.
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
