-- Groups set by hand on the admin page (agreed 12 October 2026), for events
-- whose group draw isn't on Liquipedia yet.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- No new tables: admins may now add, change and delete rows of
-- group_standings (the same table the Liquipedia sync fills). The site keeps
-- reading it as before; a later sync overwrites the hand-made rows.

grant insert, update, delete on public.group_standings to authenticated;

drop policy if exists "Admins add group standings" on public.group_standings;
create policy "Admins add group standings" on public.group_standings
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "Admins change group standings" on public.group_standings;
create policy "Admins change group standings" on public.group_standings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins delete group standings" on public.group_standings;
create policy "Admins delete group standings" on public.group_standings
  for delete to authenticated using ((select public.is_admin()));

notify pgrst, 'reload schema';
