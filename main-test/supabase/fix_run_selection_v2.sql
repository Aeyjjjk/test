-- Fixes: "column reference ... is ambiguous" when running run_selection().
-- Cause: RETURNS TABLE(selection_id, employee_id, tag_id, full_name,
-- department, cycle_number) implicitly declares variables with those names
-- inside the function. Several queries referenced the real table columns
-- cycle_number / employee_id / department without a table/CTE alias, so
-- Postgres couldn't tell them apart from the implicit variables. This
-- version qualifies every one of them. Safe to re-run.

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
set search_path = public, pg_temp
as $$
declare
  v_cycle_id         uuid;
  v_cycle_number     integer;
  v_picked           uuid[];
  v_cooldown_rounds  integer := 4;    -- rounds a passed result stays de-weighted
  v_cooldown_weight  numeric := 0.25; -- relative draw chance while in cooldown (1.0 = normal)
begin
  select coalesce(max(tc.cycle_number), 0) + 1 into v_cycle_number from test_cycles tc;
  insert into test_cycles (cycle_number, completed_at)
    values (v_cycle_number, now())
    returning id into v_cycle_id;

  -- one per distinct department first, weighted-random within each department
  with resolved_history as (
    select s.employee_id as emp_id, s.result, c.cycle_number as round_no,
           row_number() over (partition by s.employee_id order by c.cycle_number desc) as rn
    from test_selections s
    join test_cycles c on c.id = s.cycle_id
    where s.status <> 'pending'
  ),
  last_resolved as (
    select rh.emp_id, rh.result, rh.round_no from resolved_history rh where rh.rn = 1
  ),
  pool as (
    select
      e.id as emp_id, e.department as dept,
      case
        when lr.result = 'negative' and (v_cycle_number - lr.round_no) < v_cooldown_rounds
          then v_cooldown_weight
        else 1.0
      end as weight
    from employees e
    cross join lateral shift_phase(e.shift_group, now()) sp
    left join last_resolved lr on lr.emp_id = e.id
    where e.active
      and sp.on_duty
      and not exists (
        select 1 from test_selections s2 where s2.employee_id = e.id and s2.status = 'pending'
      )
  ),
  keyed as (
    select p.emp_id, p.dept, power(random(), 1.0 / p.weight) as sample_key
    from pool p
  )
  select array_agg(pick.emp_id) into v_picked
  from (
    select distinct on (k.dept) k.emp_id
    from keyed k
    order by k.dept, k.sample_key desc
    limit p_count
  ) pick;

  -- top up with the next-highest-weighted candidates if fewer distinct
  -- departments were on duty than the requested draw size
  if coalesce(array_length(v_picked, 1), 0) < p_count then
    with resolved_history as (
      select s.employee_id as emp_id, s.result, c.cycle_number as round_no,
             row_number() over (partition by s.employee_id order by c.cycle_number desc) as rn
      from test_selections s
      join test_cycles c on c.id = s.cycle_id
      where s.status <> 'pending'
    ),
    last_resolved as (
      select rh.emp_id, rh.result, rh.round_no from resolved_history rh where rh.rn = 1
    ),
    pool as (
      select
        e.id as emp_id,
        case
          when lr.result = 'negative' and (v_cycle_number - lr.round_no) < v_cooldown_rounds
            then v_cooldown_weight
          else 1.0
        end as weight
      from employees e
      cross join lateral shift_phase(e.shift_group, now()) sp
      left join last_resolved lr on lr.emp_id = e.id
      where e.active
        and sp.on_duty
        and not exists (
          select 1 from test_selections s2 where s2.employee_id = e.id and s2.status = 'pending'
        )
        and e.id <> all (coalesce(v_picked, array[]::uuid[]))
    )
    select v_picked || array_agg(fill.emp_id) into v_picked
    from (
      select p.emp_id, power(random(), 1.0 / p.weight) as sample_key
      from pool p
      order by sample_key desc
      limit (p_count - coalesce(array_length(v_picked, 1), 0))
    ) fill;
  end if;

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
