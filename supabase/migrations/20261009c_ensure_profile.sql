-- Profiles for accounts that never went through the sign-in trigger
-- (9 October 2026). Accounts created before 20261009_accounts.sql (e.g. from
-- the old project), or people who stay signed in without signing in again,
-- had no profile, so saving failed ("violates foreign key ... user_id_fkey").
-- Run once in the Supabase SQL editor. Safe to re-run.

-- 1. Backfill: a profile for every existing account.
insert into public.profiles (id, display_name, twitch_login, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'nickname', u.raw_user_meta_data ->> 'preferred_username',
           'Player'),
  coalesce(u.raw_user_meta_data ->> 'preferred_username', u.raw_user_meta_data ->> 'nickname',
           u.raw_user_meta_data ->> 'slug', u.raw_user_meta_data ->> 'user_name'),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;

-- 2. Safety net: the site calls this when someone is signed in. It creates
-- or refreshes the caller's own profile (never anyone else's) from their
-- Twitch details, and returns it.
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb;
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select coalesce(u.raw_user_meta_data, '{}'::jsonb) into meta
  from auth.users u where u.id = auth.uid();

  insert into public.profiles (id, display_name, twitch_login, avatar_url)
  values (
    auth.uid(),
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
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;
