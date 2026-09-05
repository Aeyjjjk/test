-- ============================================================================
-- Migration: shift-based eligibility + cooldown-weighted random selection
-- Run this once in the Supabase SQL Editor, after schema.sql / grants.sql /
-- public_functions.sql have already been run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SHIFT GROUPS
-- A and B rotate: 2 days morning, 2 days night, 2 days off, repeating, offset
-- from each other by 3 days so coverage overlaps. C and D work Day only,
-- every day. Hours below are a best guess — adjust to match your actual
-- schedule by updating this table.
-- ----------------------------------------------------------------------------
create table if not exists shift_groups (
  code            text primary key,
  label           text not null,
  rotation_type   text not null check (rotation_type in ('day_only', 'rotating')),
  rotation_start  date,          -- reference "day 0" of the 6-day cycle (rotating groups only)
  morning_start   time not null, -- for day_only groups, this is the Day window
  morning_end     time not null,
  night_start     time,          -- only used by rotating groups
  night_end       time
);

insert into shift_groups (code, label, rotation_type, rotation_start, morning_start, morning_end, night_start, night_end)
values
  ('A', 'Shift A', 'rotating', current_date,     '06:00', '18:00', '18:00', '06:00'),
  ('B', 'Shift B', 'rotating', current_date + 3, '06:00', '18:00', '18:00', '06:00'),
  ('C', 'Shift C', 'day_only', null,             '08:00', '17:00', null,    null),
  ('D', 'Shift D', 'day_only', null,             '08:00', '17:00', null,    null)
on conflict (code) do nothing;

alter table shift_groups enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'shift_groups' and policyname = 'authenticated read') then
    create policy "authenticated read" on shift_groups
      for select using (auth.role() = 'authenticated');
  end if;
end $$;
grant select on shift_groups to authenticated;

-- Every employee belongs to one of the four groups. Existing employees
-- default to C (day shift) until you reassign them.
alter table employees add column if not exists shift_group text not null default 'C'
  references shift_groups(code);

-- ----------------------------------------------------------------------------
-- 2. SHIFT PHASE — is this person on duty right now?
-- ----------------------------------------------------------------------------
create or replace function shift_phase(p_group text, p_at timestamptz default now())
returns table (label text, on_duty boolean)
language plpgsql
stable
as $$
declare
  g               shift_groups%rowtype;
  d_today         int;
  d_yesterday     int;
  phase_today     text;
  phase_yesterday text;
  t               time := p_at::time;
  today           date := p_at::date;
begin
  select * into g from shift_groups where code = p_group;
  if not found then
    return query select 'Unknown'::text, false;
    return;
  end if;

  if g.rotation_type = 'day_only' then
    return query select 'Day'::text, (t >= g.morning_start and t < g.morning_end);
    return;
  end if;

  -- rotating: 6-day pattern — days 0-1 morning, 2-3 night, 4-5 off
  d_today     := (((today - g.rotation_start) % 6) + 6) % 6;
  d_yesterday := (((today - 1 - g.rotation_start) % 6) + 6) % 6;

  phase_today     := case when d_today in (0,1) then 'Morning' when d_today in (2,3) then 'Night' else 'Off' end;
  phase_yesterday := case when d_yesterday in (0,1) then 'Morning' when d_yesterday in (2,3) then 'Night' else 'Off' end;

  if phase_today = 'Morning' and t >= g.morning_start and t < g.morning_end then
    return query select 'Morning'::text, true;
  elsif phase_today = 'Night' and t >= g.night_start then
    -- evening portion of a night shift (e.g. 18:00-23:59 on a Night day)
    return query select 'Night'::text, true;
  elsif phase_yesterday = 'Night' and t < g.night_end then
    -- early-morning portion of last night's shift spilling past midnight
    return query select 'Night'::text, true;
  else
    return query select phase_today, false;
  end if;
end;
$$;

grant execute on function shift_phase(text, timestamptz) to authenticated;

-- Live view: who's on duty right now, for the Employees page to display.
create or replace view v_employee_shift_now as
select e.id as employee_id, e.tag_id, e.full_name, e.department, e.shift_group,
       sp.label, sp.on_duty
from employees e
cross join lateral shift_phase(e.shift_group, now()) sp;

grant select on v_employee_shift_now to authenticated;

-- ----------------------------------------------------------------------------
-- 3. SELECTION ENGINE v2
-- Replaces the old "must exhaust the whole roster before repeating" rule.
-- Every run is its own round. The pool is: active, currently on duty (per
-- shift_phase), and not already awaiting a pending result. Anyone whose most
-- recent RESOLVED result was "negative" (passed) within the last
-- v_cooldown_rounds rounds gets a much lower — not zero — chance of being
-- drawn again, via weighted random sampling (Efraimidis-Spirakis method).
-- ----------------------------------------------------------------------------
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
