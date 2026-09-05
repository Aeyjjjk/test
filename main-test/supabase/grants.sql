-- Run this once in the Supabase SQL Editor.
-- RLS policies only restrict which ROWS a role can see/change; Postgres
-- still requires an explicit GRANT before the role can touch the table at
-- all. This adds the grants the schema.sql file was missing.

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on employees, test_cycles, test_selections, activity_logs
  to authenticated;

grant select on v_test_history to authenticated;

grant execute on function run_selection(integer) to authenticated;
