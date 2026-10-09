/**
 * Copies one tournament from Liquipedia into Supabase.
 *
 *   npm run sync -- PGL/Wallachia/9             fetch from Liquipedia and save
 *   npm run sync -- PGL/Wallachia/9 --dry-run   show what would change, write nothing
 *   npm run sync -- PGL/Wallachia/9 --cached    reuse the last download (no API calls)
 *   npm run sync -- PGL/Wallachia/9 --event <events.id>
 *                                               link the page to an existing event
 *
 * Makes 4 Liquipedia requests (tournament, match, standingsentry, placement);
 * the API allows 60 an hour. Responses are kept in liquipedia-cache/ (git-ignored).
 *
 * Writes (Supabase, with the service role key, which bypasses row level security):
 *   events            finds the event by liquipedia_page, or links/creates one
 *   teams             matched by liquipedia_template, then by name; new teams
 *                     are created without a logo (add one, then `npm run logos`)
 *   event_teams       every participating team
 *   matches           group stage and playoff bracket, with bracket links
 *   group_standings   the group table after every round, with each team's group
 *   event_placements  final placements (e.g. 9-11)
 *
 * Needs in .env.local (server only, never NEXT_PUBLIC_):
 *   LIQUIPEDIA_API_KEY, SUPABASE_SERVICE_ROLE_KEY, plus NEXT_PUBLIC_SUPABASE_URL.
 * Data is from Liquipedia (CC-BY-SA); the site must credit it where shown.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const page = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--event");
const dryRun = args.includes("--dry-run");
const useCache = args.includes("--cached");
const eventIdArg = args.includes("--event") ? args[args.indexOf("--event") + 1] : null;

// --- Small helpers -----------------------------------------------------------

async function readEnv() {
  const text = await readFile(path.join(root, ".env.local"), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function slugify(text) {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const asInt = (value) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
};

/** "PGL/Wallachia/9" with spaces or underscores, as Liquipedia stores it. */
function normalisePage(input) {
  return input
    .replace(/^https?:\/\/liquipedia\.net\/dota2\//, "")
    .replace(/ /g, "_")
    .replace(/\/$/, "");
}

// --- Liquipedia --------------------------------------------------------------

async function fetchAll(env, pageName) {
  const cacheDir = path.join(root, "liquipedia-cache", slugify(pageName));
  const datasets = {
    tournament: { type: "tournament", conditions: `[[pagename::${pageName}]]`, limit: 1 },
    matches: { type: "match", conditions: `[[parent::${pageName}]]`, limit: 1000 },
    standings: { type: "standingsentry", conditions: `[[parent::${pageName}]]`, limit: 2000 },
    placements: { type: "placement", conditions: `[[parent::${pageName}]]`, limit: 500 },
  };
  const result = {};

  for (const [name, query] of Object.entries(datasets)) {
    const file = path.join(cacheDir, `${name}.json`);
    if (useCache) {
      if (!existsSync(file)) throw new Error(`No cached ${name} for ${pageName}; run without --cached first.`);
      result[name] = JSON.parse(await readFile(file, "utf8")).result;
      continue;
    }
    const url = new URL(`https://api.liquipedia.net/api/v3/${query.type}`);
    url.search = new URLSearchParams({
      wiki: "dota2",
      conditions: query.conditions,
      limit: String(query.limit),
    });
    const response = await fetch(url, {
      headers: {
        Authorization: `Apikey ${env.LIQUIPEDIA_API_KEY}`,
        "Accept-Encoding": "gzip",
        "User-Agent": "dota2-predictions-sync/1.0",
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Liquipedia ${query.type}: HTTP ${response.status} ${text.slice(0, 200)}`);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, text);
    result[name] = JSON.parse(text).result ?? [];
  }

  if (result.tournament.length === 0) {
    throw new Error(`Liquipedia has no tournament page "${pageName}" (check the spelling and capitals).`);
  }
  return { ...result, tournament: result.tournament[0] };
}

// --- Bracket links -----------------------------------------------------------

/**
 * Where each playoff match's winner and loser go (next match id and slot).
 *
 * Winners: Liquipedia stores the next match (upperMatchId); the slot comes
 * from that match's loweredges / toupper / tolower.
 * Losers: not stored. Each lower-bracket slot that no lower match feeds is
 * filled by an upper-bracket loser. Upper round 1 losers fill the first free
 * slots in order; later upper rounds fill theirs in reverse (Liquipedia's
 * usual crossover, which avoids rematches). For finished matches the actual
 * results are checked and win over the rule.
 */
function bracketLinks(playoffMatches) {
  const byId = new Map(playoffMatches.map((m) => [m.match2id, m]));
  const links = new Map(playoffMatches.map((m) => [m.match2id, {}]));
  const fedSlots = new Map(); // match id -> Set of slots fed by another match's winner

  for (const match of playoffMatches) {
    const data = match.match2bracketdata ?? {};
    const parentId = data.upperMatchId;
    if (!parentId || !byId.has(parentId)) continue;
    const parent = byId.get(parentId).match2bracketdata ?? {};
    let slot = null;
    const lowerIds = parent.lowerMatchIds ?? [];
    for (const edge of parent.loweredges ?? []) {
      if (lowerIds[edge.lowerMatchIndex] === match.match2id) slot = edge.opponentIndex + 1;
    }
    if (!slot && parent.toupper === match.match2id) slot = 1;
    if (!slot && parent.tolower === match.match2id) slot = 2;
    if (!slot) slot = lowerIds.indexOf(match.match2id) === 0 ? 1 : 2;
    links.get(match.match2id).winner_to = parentId;
    links.get(match.match2id).winner_to_slot = slot;
    if (!fedSlots.has(parentId)) fedSlots.set(parentId, new Set());
    fedSlots.get(parentId).add(slot);
  }

  const roundOf = (m) => asInt(m.match2id.match(/_R(\d+)-M/)?.[1]) ?? 0;
  const numberOf = (m) => asInt(m.match2id.match(/-M(\d+)$/)?.[1]) ?? 0;
  const order = (a, b) => roundOf(a) - roundOf(b) || numberOf(a) - numberOf(b);
  const section = (m) => m.match2bracketdata?.bracketsection;

  // Upper matches that send a loser down: all except the grand final.
  const upper = playoffMatches
    .filter((m) => section(m) === "upper" && m.match2bracketdata?.upperMatchId)
    .sort(order);
  const freeSlots = playoffMatches
    .filter((m) => section(m) === "lower")
    .sort(order)
    .flatMap((m) =>
      [1, 2]
        .filter((slot) => !fedSlots.get(m.match2id)?.has(slot))
        .map((slot) => ({ id: m.match2id, slot })),
    );

  const upperRounds = [...new Set(upper.map(roundOf))].sort((a, b) => a - b);
  let cursor = 0;
  upperRounds.forEach((round, roundIndex) => {
    const losers = upper.filter((m) => roundOf(m) === round);
    const chunk = freeSlots.slice(cursor, cursor + losers.length);
    cursor += losers.length;
    if (roundIndex > 0) chunk.reverse();
    losers.forEach((match, index) => {
      const target = chunk[index];
      if (target) {
        links.get(match.match2id).loser_to = target.id;
        links.get(match.match2id).loser_to_slot = target.slot;
      }
    });
  });

  // Check against real results where the matches have been played.
  const corrections = [];
  for (const match of upper) {
    const winner = asInt(match.winner);
    if (!winner) continue;
    const loserTemplate = match.match2opponents?.[winner === 1 ? 1 : 0]?.template;
    if (!loserTemplate) continue;
    const actual = playoffMatches
      .filter((m) => section(m) === "lower")
      .find((m) => m.match2opponents?.some((o) => o.template === loserTemplate));
    if (!actual) continue;
    const slot = actual.match2opponents.findIndex((o) => o.template === loserTemplate) + 1;
    const link = links.get(match.match2id);
    if (link.loser_to !== actual.match2id || link.loser_to_slot !== slot) {
      corrections.push(`${match.match2id}: rule said ${link.loser_to}/${link.loser_to_slot}, results say ${actual.match2id}/${slot}`);
      link.loser_to = actual.match2id;
      link.loser_to_slot = slot;
    }
  }

  return { links, corrections };
}

// --- Main --------------------------------------------------------------------

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
  const check = (label, { data, error }) => {
    if (error) throw new Error(`${label}: ${error.message}`);
    return data;
  };

  console.log(`${dryRun ? "[dry run] " : ""}Syncing ${pageName}${useCache ? " from cache" : " from Liquipedia (4 requests)"}...`);
  const lp = await fetchAll(env, pageName);
  const t = lp.tournament;
  console.log(`  ${t.name}: ${t.startdate} to ${t.enddate}, ${t.participantsnumber} teams, ${lp.matches.length} matches`);

  // --- Group stage format ---
  const formatText = String(t.format ?? "").toLowerCase();
  const groupFormat = formatText.includes("swiss")
    ? "swiss"
    : formatText.includes("round-robin") || formatText.includes("round robin")
      ? "round_robin"
      : formatText.includes("gsl")
        ? "gsl"
        : lp.matches.some((m) => m.match2bracketdata?.type !== "bracket")
          ? "other"
          : null;
  console.log(`  group stage format: ${groupFormat ?? "none"} ("${t.format ?? ""}")`);

  // --- Event ---
  let event = check("events", await db.from("events").select("*").eq("liquipedia_page", pageName).maybeSingle());
  if (!event && eventIdArg) {
    event = check("events", await db.from("events").select("*").eq("id", eventIdArg).maybeSingle());
    if (!event) throw new Error(`No event with id ${eventIdArg}`);
    console.log(`  event: linking existing "${event.name}" to ${pageName}`);
    if (!dryRun) check("link event", await db.from("events").update({ liquipedia_page: pageName }).eq("id", event.id));
  } else if (!event) {
    const today = new Date().toISOString().slice(0, 10);
    const status = t.enddate < today ? "finished" : t.startdate > today ? "upcoming" : "live";
    const newEvent = {
      name: t.name,
      slug: slugify(t.name),
      start_date: `${t.startdate}T00:00:00Z`,
      end_date: `${t.enddate}T23:59:59Z`,
      prediction_deadline: `${t.startdate}T00:00:00Z`,
      status,
      liquipedia_page: pageName,
      group_format: groupFormat,
    };
    console.log(`  event: creating "${t.name}" (${status}; no banner, add image_url in the dashboard)`);
    event = dryRun
      ? { id: "(new event)", ...newEvent }
      : check("create event", await db.from("events").insert(newEvent).select().single());
  } else {
    console.log(`  event: updating "${event.name}"`);
  }
  if (!dryRun && event.group_format !== groupFormat) {
    check("group format", await db.from("events").update({ group_format: groupFormat }).eq("id", event.id));
  }

  // --- Teams ---
  const opponents = new Map(); // template -> teamtemplate info
  const addOpponent = (template, info) => {
    if (template && template !== "tbd" && !opponents.has(template)) opponents.set(template, info ?? {});
  };
  for (const match of lp.matches) {
    for (const o of match.match2opponents ?? []) {
      if (o.type === "team") addOpponent(o.template, { ...o.teamtemplate, name: o.teamtemplate?.name ?? o.name });
    }
  }
  for (const row of [...lp.standings, ...lp.placements]) {
    if (row.opponenttype === "team") addOpponent(row.opponenttemplate, { name: row.opponentname });
  }

  const allTeams = check("teams", await db.from("teams").select("id, name, short_name, liquipedia_template"));
  const lower = (s) => (s ?? "").trim().toLowerCase();
  const plain = (s) => lower(s).replace(/\s*\([^)]*\)\s*$/, "");
  const teamIdByTemplate = new Map();
  const created = [];
  for (const [template, info] of opponents) {
    const names = [info.name, info.page, info.bracketname].map(plain).filter(Boolean);
    let team =
      allTeams.find((x) => x.liquipedia_template === template) ??
      allTeams.find((x) => names.includes(plain(x.name)));
    if (!team && info.shortname) {
      const sameShort = allTeams.filter((x) => lower(x.short_name) === lower(info.shortname));
      if (sameShort.length === 1) team = sameShort[0];
    }

    if (team) {
      if (team.liquipedia_template !== template) {
        console.log(`  team: "${info.name}" -> your "${team.name}" (linking)`);
        if (!dryRun) check("link team", await db.from("teams").update({ liquipedia_template: template }).eq("id", team.id));
        team.liquipedia_template = template;
      }
    } else {
      const newTeam = { name: info.name, short_name: info.shortname || null, liquipedia_template: template };
      created.push(info.name);
      console.log(`  team: "${info.name}" is new (creating, no logo)`);
      team = dryRun
        ? { id: `(new ${info.name})`, ...newTeam }
        : check("create team", await db.from("teams").insert(newTeam).select().single());
      allTeams.push(team);
    }
    teamIdByTemplate.set(template, team.id);
  }
  const teamId = (template) => teamIdByTemplate.get(template) ?? null;

  // --- Event teams ---
  const eventTeams = [...teamIdByTemplate.values()].map((id) => ({ event_id: event.id, team_id: id }));
  console.log(`  event_teams: ${eventTeams.length} teams`);
  if (!dryRun) {
    check("event_teams", await db.from("event_teams").upsert(eventTeams, { onConflict: "event_id,team_id", ignoreDuplicates: true }));
  }

  // --- Matches ---
  const playoffs = lp.matches.filter((m) => m.match2bracketdata?.type === "bracket");
  const { links, corrections } = bracketLinks(playoffs);
  for (const line of corrections) console.log(`  bracket: corrected loser route ${line}`);

  const matchRows = lp.matches.map((m) => {
    const data = m.match2bracketdata ?? {};
    const isBracket = data.type === "bracket";
    const [a, b] = m.match2opponents ?? [];
    const score = (o) => (o && Number(o.score) >= 0 ? Number(o.score) : null);
    const link = links.get(m.match2id) ?? {};
    return {
      event_id: event.id,
      liquipedia_id: m.match2id,
      stage: isBracket ? "playoffs" : "group",
      section: m.section || null,
      bracket_section: isBracket ? data.bracketsection || null : null,
      round: isBracket
        ? asInt(m.match2id.match(/_R(\d+)-M/)?.[1]) ?? 0
        : asInt(m.section?.match(/(\d+)/)?.[1]) ?? asInt(data.groupRoundIndex) ?? 0,
      match_number: isBracket ? asInt(m.match2id.match(/-M(\d+)$/)?.[1]) ?? 0 : asInt(data.matchIndex) ?? 0,
      team1_id: a?.type === "team" ? teamId(a.template) : null,
      team2_id: b?.type === "team" ? teamId(b.template) : null,
      score1: score(a),
      score2: score(b),
      winner: [1, 2].includes(asInt(m.winner)) ? asInt(m.winner) : null,
      best_of: asInt(m.bestof),
      starts_at: m.extradata?.timestamp
        ? new Date(Number(m.extradata.timestamp) * 1000).toISOString()
        : m.date ? `${m.date.replace(" ", "T")}Z` : null,
      finished: String(m.finished) === "1" || m.finished === true,
      winner_to: link.winner_to ?? null,
      winner_to_slot: link.winner_to_slot ?? null,
      loser_to: link.loser_to ?? null,
      loser_to_slot: link.loser_to_slot ?? null,
      updated_at: new Date().toISOString(),
    };
  });
  const groupCount = matchRows.filter((r) => r.stage === "group").length;
  console.log(`  matches: ${groupCount} group stage, ${matchRows.length - groupCount} playoffs`);
  if (!dryRun) check("matches", await db.from("matches").upsert(matchRows, { onConflict: "liquipedia_id" }));

  // --- Group standings ---
  const standingRows = lp.standings
    .filter((s) => s.opponenttype === "team" && teamId(s.opponenttemplate))
    .map((s) => ({
      event_id: event.id,
      team_id: teamId(s.opponenttemplate),
      round: asInt(s.roundindex) ?? 0,
      group_index: asInt(s.standingsindex) ?? 0,
      placement: asInt(s.placement),
      wins: asInt(s.scoreboard?.match?.w) ?? 0,
      losses: asInt(s.scoreboard?.match?.l) ?? 0,
      draws: asInt(s.scoreboard?.match?.d) ?? 0,
      status: s.currentstatus || s.definitestatus || null,
    }));
  console.log(`  group_standings: ${standingRows.length} rows`);
  if (!dryRun && standingRows.length) {
    check("group_standings", await db.from("group_standings").upsert(standingRows, { onConflict: "event_id,team_id,round" }));
  }

  // --- Placements ---
  const placementRows = lp.placements
    .filter((p) => p.opponenttype === "team" && teamId(p.opponenttemplate) && asInt(p.placement))
    .map((p) => {
      const [from, to] = String(p.placement).split("-").map((v) => asInt(v));
      return {
        event_id: event.id,
        team_id: teamId(p.opponenttemplate),
        place_from: from,
        place_to: to ?? from,
        prize_money: p.prizemoney ? Number(p.prizemoney) : null,
      };
    });
  console.log(`  event_placements: ${placementRows.length} rows`);
  if (!dryRun && placementRows.length) {
    check("event_placements", await db.from("event_placements").upsert(placementRows, { onConflict: "event_id,team_id" }));
  }

  console.log(dryRun ? "\nDry run finished: nothing was written." : "\nDone.");
  if (created.length) {
    console.log(`New teams without logos: ${created.join(", ")}. Add logo URLs in the dashboard, then run npm run logos.`);
  }
}

main().catch((reason) => {
  console.error(`\n${reason.message ?? reason}`);
  process.exit(1);
});
