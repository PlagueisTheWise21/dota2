/**
 * Copies one tournament from Liquipedia into Supabase (lib/liquipedia-sync.mjs).
 * The admin page has the same thing as a button; this is the command-line way.
 *
 *   npm run sync -- PGL/Wallachia/9             fetch from Liquipedia and save
 *   npm run sync -- PGL/Wallachia/9 --dry-run   show what would change, write nothing
 *   npm run sync -- PGL/Wallachia/9 --cached    reuse the last download (no API calls)
 *   npm run sync -- PGL/Wallachia/9 --event <events.id>
 *                                               link the page to an existing event
 *
 * Makes 4 Liquipedia requests; the API allows 60 an hour. Responses are kept
 * in liquipedia-cache/ (git-ignored).
 *
 * Needs in .env.local (server only, never NEXT_PUBLIC_):
 *   LIQUIPEDIA_API_KEY, SUPABASE_SERVICE_ROLE_KEY, plus NEXT_PUBLIC_SUPABASE_URL.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchLiquipedia, normalisePage, slugify, syncTournament } from "../lib/liquipedia-sync.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const page = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--event");
const dryRun = args.includes("--dry-run");
const useCache = args.includes("--cached");
const eventIdArg = args.includes("--event") ? args[args.indexOf("--event") + 1] : null;

async function readEnv() {
  const text = await readFile(path.join(root, ".env.local"), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

async function main() {
  if (!page) {
    throw new Error("Usage: npm run sync -- <Liquipedia page, e.g. PGL/Wallachia/9> [--dry-run] [--cached] [--event <id>]");
  }
  const pageName = normalisePage(page);
  const env = await readEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing from .env.local");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  if (!useCache && !env.LIQUIPEDIA_API_KEY) throw new Error("LIQUIPEDIA_API_KEY missing from .env.local");

  const db = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Every response is saved, so --cached can replay the last download.
  const cacheDir = path.join(root, "liquipedia-cache", slugify(pageName));
  async function loadDataset(name, query) {
    const file = path.join(cacheDir, `${name}.json`);
    if (useCache) {
      if (!existsSync(file)) throw new Error(`No cached ${name} for ${pageName}; run without --cached first.`);
      return JSON.parse(await readFile(file, "utf8")).result;
    }
    const text = await fetchLiquipedia(env.LIQUIPEDIA_API_KEY, query);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, text);
    return JSON.parse(text).result;
  }

  console.log(useCache ? "Using the last download (no API calls)." : "Fetching from Liquipedia (4 requests).");
  const { createdTeams } = await syncTournament({ db, pageName, eventId: eventIdArg, dryRun, loadDataset });

  console.log(dryRun ? "\nDry run finished: nothing was written." : "\nDone.");
  if (createdTeams.length) {
    console.log(`New teams without logos: ${createdTeams.join(", ")}. Add logos on the admin page (Teams).`);
  }
}

main().catch((reason) => {
  console.error(`\n${reason.message ?? reason}`);
  process.exit(1);
});
