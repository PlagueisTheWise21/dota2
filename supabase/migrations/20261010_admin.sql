-- Admin panel (agreed 9 October 2026).
-- Run once in the Supabase SQL editor. Safe to re-run: every step checks first.
--
-- admins                   who may use /admin (one row per admin account)
-- public.is_admin()        true when the signed-in person is in admins
-- events.playoff_deadline  optional override for when playoff picks lock
-- write policies           admins may add, change and delete events, teams
--                          and event_teams from the site
-- storage buckets          team-logos and event-banners (public read,
--                          admin upload)
-- public.merge_teams()     folds a duplicate team into another one

-- Admins ------------------------------------------------------------------------

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Nobody reads or changes this table through the API; is_admin() checks it.
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Playoff deadline override -------------------------------------------------------

-- Null = automatic (first playoff match, or the event's end while no match
-- times are known). Set it to lock playoff picks at another time.
alter table public.events add column if not exists playoff_deadline timestamptz;

create or replace function public.pickem_deadline(p_event_id uuid, p_stage text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_stage = 'group' then e.prediction_deadline
    else coalesce(
      e.playoff_deadline,
      (select min(m.starts_at) from public.matches m
        where m.event_id = e.id and m.stage = 'playoffs'),
      e.end_date)
  end
  from public.events e
  where e.id = p_event_id;
$$;

-- Admin writes on events, teams and event_teams ----------------------------------

grant insert, update, delete on public.events, public.teams, public.event_teams to authenticated;

drop policy if exists "Admins add events" on public.events;
create policy "Admins add events" on public.events
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "Admins change events" on public.events;
create policy "Admins change events" on public.events
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins delete events" on public.events;
create policy "Admins delete events" on public.events
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "Admins add teams" on public.teams;
create policy "Admins add teams" on public.teams
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "Admins change teams" on public.teams;
create policy "Admins change teams" on public.teams
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins delete teams" on public.teams;
create policy "Admins delete teams" on public.teams
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "Admins add event teams" on public.event_teams;
create policy "Admins add event teams" on public.event_teams
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "Admins change event teams" on public.event_teams;
create policy "Admins change event teams" on public.event_teams
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins delete event teams" on public.event_teams;
create policy "Admins delete event teams" on public.event_teams
  for delete to authenticated using ((select public.is_admin()));

-- Storage: team logos and event banners ------------------------------------------

-- Public buckets: anyone can view the files by URL. Only images, kept small
-- (the admin page shrinks them before uploading).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('team-logos', 'team-logos', true, 2097152, array['image/webp', 'image/png', 'image/jpeg']),
  ('event-banners', 'event-banners', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true;

drop policy if exists "Admins upload site images" on storage.objects;
create policy "Admins upload site images" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('team-logos', 'event-banners') and (select public.is_admin()));
drop policy if exists "Admins view site images" on storage.objects;
create policy "Admins view site images" on storage.objects
  for select to authenticated
  using (bucket_id in ('team-logos', 'event-banners') and (select public.is_admin()));
drop policy if exists "Admins replace site images" on storage.objects;
create policy "Admins replace site images" on storage.objects
  for update to authenticated
  using (bucket_id in ('team-logos', 'event-banners') and (select public.is_admin()));
drop policy if exists "Admins delete site images" on storage.objects;
create policy "Admins delete site images" on storage.objects
  for delete to authenticated
  using (bucket_id in ('team-logos', 'event-banners') and (select public.is_admin()));

-- Merging duplicate teams --------------------------------------------------------

-- Moves everything that points at p_remove (event entries, matches, group
-- tables, placements, saved tier lists and pick'ems) to p_keep, fills in
-- p_keep's missing short name, logo and Liquipedia link, then deletes p_remove.
create or replace function public.merge_teams(p_keep uuid, p_remove uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed public.teams;
begin
  if not public.is_admin() then
    raise exception 'Only admins can merge teams';
  end if;
  if p_keep = p_remove then
    raise exception 'Pick two different teams';
  end if;
  select * into removed from public.teams where id = p_remove;
  if removed.id is null or not exists (select 1 from public.teams where id = p_keep) then
    raise exception 'Team not found';
  end if;

  -- Where both teams already have a row, keep p_keep's.
  delete from public.event_teams r where r.team_id = p_remove
    and exists (select 1 from public.event_teams k where k.event_id = r.event_id and k.team_id = p_keep);
  update public.event_teams set team_id = p_keep where team_id = p_remove;

  delete from public.group_standings r where r.team_id = p_remove
    and exists (select 1 from public.group_standings k
                where k.event_id = r.event_id and k.round = r.round and k.team_id = p_keep);
  update public.group_standings set team_id = p_keep where team_id = p_remove;

  delete from public.event_placements r where r.team_id = p_remove
    and exists (select 1 from public.event_placements k where k.event_id = r.event_id and k.team_id = p_keep);
  update public.event_placements set team_id = p_keep where team_id = p_remove;

  update public.matches set team1_id = p_keep where team1_id = p_remove;
  update public.matches set team2_id = p_keep where team2_id = p_remove;

  -- Saved picks hold team ids inside JSON; the site drops any duplicates.
  update public.saved_tier_lists
    set placements = replace(placements::text, p_remove::text, p_keep::text)::jsonb
    where placements::text like '%' || p_remove::text || '%';
  update public.saved_pickems
    set picks = replace(picks::text, p_remove::text, p_keep::text)::jsonb
    where picks::text like '%' || p_remove::text || '%';

  delete from public.teams where id = p_remove;
  update public.teams set
    short_name = coalesce(short_name, removed.short_name),
    logo_url = coalesce(logo_url, removed.logo_url),
    liquipedia_template = coalesce(liquipedia_template, removed.liquipedia_template)
  where id = p_keep;
end;
$$;

revoke execute on function public.merge_teams(uuid, uuid) from public, anon;
grant execute on function public.merge_teams(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- Make yourself an admin ------------------------------------------------------------
-- Put your Twitch login (the name in your Twitch URL) below and run this part.
-- It must return one row; if it returns none, sign in on the site once first.
--
-- insert into public.admins (user_id)
-- select id from public.profiles where lower(twitch_login) = lower('YOUR_TWITCH_NAME')
-- on conflict do nothing
-- returning user_id;
