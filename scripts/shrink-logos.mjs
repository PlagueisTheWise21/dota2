/**
 * Makes small, trimmed copies of team logos for fast loading.
 *
 *   npm run logos          only teams whose logo is not in the bucket yet
 *   npm run logos -- --all every team with a logo
 *
 * For each team (Supabase table `teams`, columns `id, name, logo_url`) it
 * downloads the logo, trims the empty margins, shrinks it to fit 256 x 256 px
 * and saves it as WebP in `logos-out/`. It also writes
 * `logos-out/update-logos.sql`, which points `teams.logo_url` at the copies.
 *
 * Nothing is uploaded or changed in the database. Afterwards:
 *   1. Upload the .webp files to the public Storage bucket "team-logos"
 *      (Supabase dashboard > Storage > team-logos > Upload).
 *   2. Run update-logos.sql in the Supabase SQL editor.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and the public key from .env.local (read
 * access only). Uses sharp, which is fine in a plain Node script; only the
 * Next.js dev server on this drive cannot load it (see docs/PROJECT_BRIEF.md).
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "team-logos";
const OUTPUT_SIZE = 256;
const TRIM_THRESHOLD = 10;
const FETCH_TIMEOUT_MS = 20000;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "logos-out");
const processAll = process.argv.includes("--all");

/** Minimal .env.local reader (KEY=value lines). */
async function readEnv() {
  const text = await readFile(path.join(root, ".env.local"), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** "Team Spirit" -> "team-spirit" */
function slugify(name) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "team"
  );
}

function sqlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function download(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "dota2-predictions-logo-shrinker/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`not an image (${type})`);
  return { bytes: Buffer.from(await response.arrayBuffer()), type };
}

/** Trim empty margins, shrink to fit OUTPUT_SIZE, WebP. */
async function shrink(bytes, type) {
  const options = { density: type.includes("svg") ? 300 : undefined };
  let trimmed;
  try {
    trimmed = await sharp(bytes, options)
      .trim({ threshold: TRIM_THRESHOLD })
      .png()
      .toBuffer();
  } catch {
    trimmed = await sharp(bytes, options).png().toBuffer(); // nothing to trim
  }
  return sharp(trimmed)
    .resize({
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
}

async function main() {
  const env = await readEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !key) {
    throw new Error("Supabase URL or key missing from .env.local");
  }

  const bucketPrefix = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/`;
  const supabase = createClient(supabaseUrl, key);
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, logo_url")
    .order("name");
  if (error) throw new Error(`Could not read teams: ${error.message}`);

  const todo = teams.filter(
    (team) => team.logo_url && (processAll || !team.logo_url.startsWith(bucketPrefix)),
  );
  if (todo.length === 0) {
    console.log("Every team logo is already in the bucket. Nothing to do.");
    return;
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const usedNames = new Set();
  const updates = [];
  const failures = [];

  for (const team of todo) {
    let fileName = `${slugify(team.name)}.webp`;
    if (usedNames.has(fileName)) fileName = `${slugify(team.name)}-${team.id.slice(0, 8)}.webp`;
    usedNames.add(fileName);

    try {
      // Re-processing a logo already in the bucket (--all) reuses that copy.
      const { bytes, type } = await download(team.logo_url);
      const small = await shrink(bytes, type);
      const { width, height } = await sharp(small).metadata();
      await writeFile(path.join(outDir, fileName), small);
      updates.push(
        `-- ${team.name}, was: ${team.logo_url}
update teams set logo_url = ${sqlString(bucketPrefix + fileName)} where id = ${sqlString(team.id)};`,
      );
      console.log(
        `ok    ${team.name.padEnd(20)} ${String(Math.round(bytes.length / 1024)).padStart(5)} KB -> ${String(Math.round(small.length / 1024)).padStart(3)} KB  ${width}x${height}  ${fileName}`,
      );
    } catch (reason) {
      failures.push(team.name);
      console.log(`FAIL  ${team.name.padEnd(20)} ${reason.message}`);
    }
  }

  if (updates.length > 0) {
    const sql = [
      "-- Points teams.logo_url at the small copies in the Storage bucket.",
      "-- Each team's previous URL is in the comment above its update, to undo.",
      `-- Upload the .webp files in this folder to the "${BUCKET}" bucket first.`,
      "begin;",
      ...updates,
      "commit;",
      "",
    ].join("\n");
    await writeFile(path.join(outDir, "update-logos.sql"), sql);
  }

  console.log(
    `\n${updates.length} logo(s) written to logos-out/` +
      (updates.length ? " with update-logos.sql." : ".") +
      (failures.length
        ? `\n${failures.length} failed (their host may refuse downloads; try another URL): ${failures.join(", ")}`
        : ""),
  );
}

main().catch((reason) => {
  console.error(reason.message ?? reason);
  process.exit(1);
});
