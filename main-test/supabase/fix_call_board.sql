-- Fixes: the public Testing Board (/board) showing nobody, even right after
-- a draw. Cause: get_call_board() filtered on "the round is still open"
-- (completed_at is null), which was valid under the old cycle model. Since
-- run_selection() now marks every round complete immediately (rounds are
-- instantaneous events, not open spans), that condition never matched
-- anymore. The board only needs to know a selection's own status, not
-- whether its round is "open." Safe to re-run.

create or replace function get_call_board()
returns table (
  full_name    text,
  department   text,
  selected_at  timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select e.full_name, e.department, s.selected_at
    from test_selections s
    join employees e on e.id = s.employee_id
    where s.status = 'pending'
    order by s.selected_at desc;
end;
$$;

grant execute on function get_call_board() to anon, authenticated;
