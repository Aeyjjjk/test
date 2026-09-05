-- Public-facing read functions for employees (no login required).
-- Both are SECURITY DEFINER so they can read past RLS, but each returns
-- only a narrow, non-sensitive slice of data — never test results, never
-- the full roster. Run this once in the SQL Editor after schema.sql.

-- 1. An employee looks up their own status by tag ID.
create or replace function get_employee_status(p_tag_id text)
returns table (
  found         boolean,
  full_name     text,
  department    text,
  is_pending    boolean,
  selected_at   timestamptz,
  cycle_number  integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee record;
  v_last     record;
begin
  select e.id, e.full_name, e.department into v_employee
  from employees e
  where lower(e.tag_id) = lower(trim(p_tag_id)) and e.active
  limit 1;

  if v_employee.id is null then
    return query select false, null::text, null::text, null::boolean, null::timestamptz, null::integer;
    return;
  end if;

  select s.status, s.selected_at, c.cycle_number into v_last
  from test_selections s
  join test_cycles c on c.id = s.cycle_id
  where s.employee_id = v_employee.id
  order by s.selected_at desc
  limit 1;

  return query select
    true,
    v_employee.full_name,
    v_employee.department,
    coalesce(v_last.status = 'pending', false),
    v_last.selected_at,
    v_last.cycle_number;
end;
$$;

grant execute on function get_employee_status(text) to anon, authenticated;

-- 2. Kiosk / call board: everyone currently due (status = pending).
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
