-- Liquipedia data for pick'ems and real placements (agreed 8 October 2026).
-- Run once in the Supabase SQL editor. Safe to re-run: every step checks first.
--
-- Filled by `npm run sync` (scripts/sync-liquipedia.mjs) with the service role
-- key, which bypasses row level security. The site only reads these tables.

-- Link events and teams to Liquipedia ---------------------------------------

alter table public.events
  add column if not exists liquipedia_page text unique; -- e.g. 'PGL/Wallachia/9'

alter table public.teams
  add column if not exists liquipedia_template text unique; -- e.g. 'xtreme gaming orig'

-- Matches: group stage and playoff bracket -----------------------------------

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  liquipedia_id text not null unique,           -- Liquipedia match2id
  stage text not null check (stage in ('group', 'playoffs')),
  section text,                                 -- 'Round 1', 'Playoffs'
  bracket_section text check (bracket_section in ('upper', 'lower')),
  round smallint not null,
  match_number smallint not null,               -- order within the round
  team1_id uuid references public.teams (id),   -- null while TBD
  team2_id uuid references public.teams (id),
  score1 smallint,
  score2 smallint,
  winner smallint check (winner in (1, 2)),
  best_of smallint,
  starts_at timestamptz,
  finished boolean not null default false,
  -- Bracket links (liquipedia_id of the next match, and slot 1 or 2 in it).
  winner_to text,
  winner_to_slot smallint check (winner_to_slot in (1, 2)),
  loser_to text,
  loser_to_slot smallint check (loser_to_slot in (1, 2)),
  updated_at timestamptz not null default now()
);

create index if not exists matches_event_id_idx on public.matches (event_id);

-- Group stage table after each round -----------------------------------------

create table if not exists public.group_standings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid not null references public.teams (id),
  round smallint not null,
  placement smallint,
  wins smallint not null default 0,
  losses smallint not null default 0,
  draws smallint not null default 0,
  status text,                                  -- Liquipedia: 'up', 'down', ...
  unique (event_id, team_id, round)
);

-- Final placements (real groups, e.g. 9-11) ----------------------------------

create table if not exists public.event_placements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid not null references public.teams (id),
  place_from smallint not null,
  place_to smallint not null,
  prize_money numeric,
  unique (event_id, team_id)
);

-- Everyone may read; nobody may write through the API ------------------------

alter table public.matches enable row level security;
alter table public.group_standings enable row level security;
alter table public.event_placements enable row level security;

grant select on public.matches, public.group_standings, public.event_placements
  to anon, authenticated;

drop policy if exists "Anyone can view matches" on public.matches;
create policy "Anyone can view matches" on public.matches
  for select to anon, authenticated using (true);

drop policy if exists "Anyone can view group standings" on public.group_standings;
create policy "Anyone can view group standings" on public.group_standings
  for select to anon, authenticated using (true);

drop policy if exists "Anyone can view event placements" on public.event_placements;
create policy "Anyone can view event placements" on public.event_placements
  for select to anon, authenticated using (true);
