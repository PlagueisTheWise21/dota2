-- Group stage formats (9 October 2026), for round-robin pick'ems.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- events.group_format       set by `npm run sync` from Liquipedia's format text
-- group_standings.group_index which group a team is in (0 = Group A, 1 = B...);
--                             Swiss stages have one group, so always 0

alter table public.events
  add column if not exists group_format text
  check (group_format in ('swiss', 'round_robin', 'gsl', 'other'));

alter table public.group_standings
  add column if not exists group_index smallint not null default 0;
