-- Accounts and saved picks (agreed 9 October 2026).
-- Run once in the Supabase SQL editor, after removing the old project's
-- leftover functions. Safe to re-run: every step checks first.
--
-- profiles          one per signed-in person (made automatically at sign-in)
-- saved_tier_lists  one per person per event; private
-- saved_pickems     one per person per event per stage ('group'/'playoffs');
--                   private until that stage's deadline, then public;
--                   the database refuses changes after the deadline

-- Profiles ------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  twitch_login text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Copies the Twitch name and picture from the login into profiles: on first
-- sign-in, and again whenever Supabase refreshes them on a later sign-in.
-- It never blocks a sign-in: if anything goes wrong, the login still works.
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, display_name, twitch_login, avatar_url)
  values (
    new.id,
    coalesce(meta ->> 'name', meta ->> 'full_name', meta ->> 'nickname',
             meta ->> 'preferred_username', 'Player'),
    coalesce(meta ->> 'preferred_username', meta ->> 'nickname', meta ->> 'slug',
             meta ->> 'user_name'),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    twitch_login = excluded.twitch_login,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists on_auth_user_saved on auth.users;
create trigger on_auth_user_saved
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();

-- Saved tier lists ----------------------------------------------------------

create table if not exists public.saved_tier_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  placements jsonb not null,          -- {"S": [team ids], ..., "unranked": [...]}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- Saved pick'ems --------------------------------------------------------------

create table if not exists public.saved_pickems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  stage text not null check (stage in ('group', 'playoffs')),
  picks jsonb not null,               -- group: team id per slot; playoffs: {match id: team id}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id, stage)
);

create index if not exists saved_pickems_event_idx on public.saved_pickems (event_id, stage);

-- When a stage's picks lock: the group stage at the event's prediction
-- deadline; the playoffs when the first playoff match starts (or at the
-- event's end while no match times are known).
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
      (select min(m.starts_at) from public.matches m
        where m.event_id = e.id and m.stage = 'playoffs'),
      e.end_date)
  end
  from public.events e
  where e.id = p_event_id;
$$;

-- Keep updated_at current -----------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_saved_tier_lists on public.saved_tier_lists;
create trigger touch_saved_tier_lists before update on public.saved_tier_lists
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_saved_pickems on public.saved_pickems;
create trigger touch_saved_pickems before update on public.saved_pickems
  for each row execute function public.touch_updated_at();

-- Access ----------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.saved_tier_lists enable row level security;
alter table public.saved_pickems enable row level security;

-- Profiles: everyone can see names and pictures (for leaderboards).
-- Rows are written only by the sign-in trigger above.
grant select on public.profiles to anon, authenticated;
drop policy if exists "Anyone can view profiles" on public.profiles;
create policy "Anyone can view profiles" on public.profiles
  for select to anon, authenticated using (true);

-- Tier lists: private to their owner.
grant select, insert, update, delete on public.saved_tier_lists to authenticated;
drop policy if exists "Owners manage their tier lists" on public.saved_tier_lists;
create policy "Owners manage their tier lists" on public.saved_tier_lists
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Pick'ems: owners see theirs any time; everyone sees them after the deadline.
grant select on public.saved_pickems to anon, authenticated;
grant insert, update, delete on public.saved_pickems to authenticated;

drop policy if exists "View own pick'ems or any after the deadline" on public.saved_pickems;
create policy "View own pick'ems or any after the deadline" on public.saved_pickems
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or public.pickem_deadline(event_id, stage) <= now()
  );

drop policy if exists "Owners save pick'ems before the deadline" on public.saved_pickems;
create policy "Owners save pick'ems before the deadline" on public.saved_pickems
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.pickem_deadline(event_id, stage) > now()
  );

drop policy if exists "Owners change pick'ems before the deadline" on public.saved_pickems;
create policy "Owners change pick'ems before the deadline" on public.saved_pickems
  for update to authenticated
  using (user_id = (select auth.uid()) and public.pickem_deadline(event_id, stage) > now())
  with check (user_id = (select auth.uid()) and public.pickem_deadline(event_id, stage) > now());

drop policy if exists "Owners delete pick'ems before the deadline" on public.saved_pickems;
create policy "Owners delete pick'ems before the deadline" on public.saved_pickems
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.pickem_deadline(event_id, stage) > now());

grant execute on function public.pickem_deadline(uuid, text) to anon, authenticated;
