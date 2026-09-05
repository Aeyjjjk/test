-- Fixes: "column reference cycle_number is ambiguous"
-- Cause: RETURNS TABLE(..., cycle_number, ...) implicitly declares a
-- variable named cycle_number inside the function. Two queries referenced
-- the test_cycles.cycle_number column without a table alias, so Postgres
-- couldn't tell it apart from that implicit variable. This version qualifies
-- both references with the "tc" alias. Safe to re-run.

create or replace function run_selection(p_count integer default 3)
returns table (
  selection_id  uuid,
  employee_id   uuid,
  tag_id        text,
  full_name     text,
  department    text,
  cycle_number  integer
)
language plpgsql
security definer
as $$
declare
  v_cycle_id      uuid;
  v_cycle_number  integer;
  v_pool_count    integer;
  v_picked        uuid[];
begin
  -- 1. find or open a cycle
  select tc.id, tc.cycle_number into v_cycle_id, v_cycle_number
  from test_cycles tc where tc.completed_at is null
  limit 1;

  if v_cycle_id is null then
    select coalesce(max(tc.cycle_number), 0) + 1 into v_cycle_number from test_cycles tc;
    insert into test_cycles (cycle_number) values (v_cycle_number)
      returning id into v_cycle_id;
    insert into activity_logs (action, details)
      values ('cycle_started', jsonb_build_object('cycle_number', v_cycle_number));
  end if;

  -- 2. how many untested active employees remain in this cycle?
  select count(*) into v_pool_count
  from employees e
  where e.active
    and not exists (
      select 1 from test_selections s
      where s.cycle_id = v_cycle_id and s.employee_id = e.id
    );

  -- 3. if the pool is empty, close this cycle and open the next one
  if v_pool_count = 0 then
    update test_cycles set completed_at = now() where id = v_cycle_id;
    insert into activity_logs (action, details)
      values ('cycle_completed', jsonb_build_object('cycle_number', v_cycle_number));

    v_cycle_number := v_cycle_number + 1;
    insert into test_cycles (cycle_number) values (v_cycle_number)
      returning id into v_cycle_id;
    insert into activity_logs (action, details)
      values ('cycle_started', jsonb_build_object('cycle_number', v_cycle_number));
  end if;

  -- 4a. one random pick per distinct department, up to p_count
  select array_agg(pick.id) into v_picked
  from (
    select distinct on (e.department) e.id
    from employees e
    where e.active
      and not exists (
        select 1 from test_selections s
        where s.cycle_id = v_cycle_id and s.employee_id = e.id
      )
    order by e.department, random()
    limit p_count
  ) pick;

  -- 4b. top up with random individuals if departments gave us fewer than p_count
  if coalesce(array_length(v_picked, 1), 0) < p_count then
    select v_picked || array_agg(fill.id) into v_picked
    from (
      select e.id
      from employees e
      where e.active
        and not exists (
          select 1 from test_selections s
          where s.cycle_id = v_cycle_id and s.employee_id = e.id
        )
        and e.id <> all (coalesce(v_picked, array[]::uuid[]))
      order by random()
      limit (p_count - coalesce(array_length(v_picked, 1), 0))
    ) fill;
  end if;

  -- 5. record the draw
  insert into test_selections (cycle_id, employee_id)
  select v_cycle_id, x from unnest(v_picked) as x;

  insert into activity_logs (action, details)
    values ('selection_run', jsonb_build_object(
      'cycle_number', v_cycle_number,
      'count', coalesce(array_length(v_picked, 1), 0),
      'employee_ids', to_jsonb(v_picked)
    ));

  return query
    select s.id, e.id, e.tag_id, e.full_name, e.department, v_cycle_number
    from test_selections s
    join employees e on e.id = s.employee_id
    where s.cycle_id = v_cycle_id and e.id = any(v_picked);
end;
$$;

grant execute on function run_selection(integer) to authenticated;
