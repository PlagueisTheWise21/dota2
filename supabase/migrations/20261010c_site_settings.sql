-- Site settings editable from the admin page (agreed 10 October 2026).
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- site_settings   one row: the browser tab title and tab icon (favicon)
-- site-assets     storage bucket for the uploaded tab icon

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),   -- always exactly one row
  site_title text not null default 'Dota 2 Predictions & Tier Lists',
  favicon_url text,                                    -- null = the default icon
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists touch_site_settings on public.site_settings;
create trigger touch_site_settings before update on public.site_settings
  for each row execute function public.touch_updated_at();

alter table public.site_settings enable row level security;

-- Everyone can read them (every page uses them); only admins can change them.
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

drop policy if exists "Anyone can view site settings" on public.site_settings;
create policy "Anyone can view site settings" on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists "Admins change site settings" on public.site_settings;
create policy "Admins change site settings" on public.site_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Storage: the tab icon ----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-assets', 'site-assets', true, 1048576, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update set public = true;

-- The admin image policies from 20261010_admin.sql, now including site-assets.
drop policy if exists "Admins upload site images" on storage.objects;
create policy "Admins upload site images" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('team-logos', 'event-banners', 'site-assets') and (select public.is_admin()));
drop policy if exists "Admins view site images" on storage.objects;
create policy "Admins view site images" on storage.objects
  for select to authenticated
  using (bucket_id in ('team-logos', 'event-banners', 'site-assets') and (select public.is_admin()));
drop policy if exists "Admins replace site images" on storage.objects;
create policy "Admins replace site images" on storage.objects
  for update to authenticated
  using (bucket_id in ('team-logos', 'event-banners', 'site-assets') and (select public.is_admin()));
drop policy if exists "Admins delete site images" on storage.objects;
create policy "Admins delete site images" on storage.objects
  for delete to authenticated
  using (bucket_id in ('team-logos', 'event-banners', 'site-assets') and (select public.is_admin()));

notify pgrst, 'reload schema';
