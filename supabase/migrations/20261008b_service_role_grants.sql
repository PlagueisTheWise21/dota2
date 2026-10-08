-- Restores Supabase's default table permissions for the service role
-- (8 October 2026). They had been removed during the earlier clean-up, so
-- `npm run sync`, which uses the service role key, got "permission denied".
-- The service role is server-only; browsers still use anon/authenticated,
-- whose read-only access is unchanged.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- Also for tables created later.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines to service_role;
