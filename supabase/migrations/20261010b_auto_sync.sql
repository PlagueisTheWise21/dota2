-- Automatic Liquipedia sync during live events (agreed 10 October 2026).
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- events.auto_sync       the admin page's on/off switch (default off)
-- events.last_synced_at  when the sync last wrote this event; the event page
--                        re-syncs a live event at most every 30 minutes

alter table public.events add column if not exists auto_sync boolean not null default false;
alter table public.events add column if not exists last_synced_at timestamptz;

notify pgrst, 'reload schema';
