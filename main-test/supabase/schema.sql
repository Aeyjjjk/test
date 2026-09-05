-- ============================================================================
-- Drug & Alcohol Random Testing Program — Supabase schema
-- Run this whole file once in the Supabase SQL editor (Project > SQL Editor).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- EMPLOYEES
-- ----------------------------------------------------------------------------
create table if not exists employees (
  id          uuid primary key default gen_random_uuid(),
  tag_id      text unique not null,
  full_name   text not null,
  department  text not null,
  email       text,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_employees_active on employees(active);
create index if not exists idx_employees_department on employees(department);

-- ----------------------------------------------------------------------------
-- TEST CYCLES
-- A cycle is one full pass through the active roster. When every active
-- employee has been selected at least once, the cycle closes and a new one
-- opens, so the pool "reshuffles" only after everyone has had a turn.
-- ----------------------------------------------------------------------------
create table if not exists test_cycles (
  id             uuid primary key default gen_random_uuid(),
  cycle_number   integer not null,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create unique index if not exists idx_one_open_cycle
  on test_cycles ((completed_at is null))
  where completed_at is null;

-- ----------------------------------------------------------------------------
-- TEST SELECTIONS
-- One row per employee, per cycle, per draw.
-- ----------------------------------------------------------------------------
create table if not exists test_selections (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references test_cycles(id) on delete cascade,
  employee_id  uuid not null references employees(id) on delete cascade,
  selected_at  timestamptz not null default now(),
  status       text not null default 'pending'
               check (status in ('pending','tested','no_show','excused')),
  tested_at    timestamptz,
  result       text check (result in ('negative','positive','refused','inconclusive')),
  notes        text,
  unique (cycle_id, employee_id)
);

create index if not exists idx_selections_cycle on test_selections(cycle_id);
create index if not exists idx_selections_employee on test_selections(employee_id);
create index if not exists idx_selections_selected_at on test_selections(selected_at);

-- ----------------------------------------------------------------------------
-- ACTIVITY LOG
-- ----------------------------------------------------------------------------
create table if not exists activity_logs (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null default 'system',
  action      text not null,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_logs_created_at on activity_logs(created_at desc);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY — every table is admin-only (any authenticated user).
-- Admin accounts are created in Supabase Auth (Authentication > Users) and
-- log in from the app; there is no public-facing page in this build.
-- ----------------------------------------------------------------------------
alter table employees        enable row level security;
alter table test_cycles      enable row level security;
alter table test_selections  enable row level security;
alter table activity_logs    enable row level security;

create policy "authenticated full access" on employees
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on test_cycles
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on test_selections
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on activity_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- SELECTION ENGINE
-- run_selection(p_count) draws p_count employees, preferring one per distinct
-- department first, then filling any remainder at random. It never repeats an
-- employee within the current cycle; once the pool of untested active
-- employees is exhausted it closes that cycle, opens the next one, and draws
-- fresh from the full roster again.
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

-- ----------------------------------------------------------------------------
-- REPORTING VIEW — used for the export screen and the dashboard charts
-- ----------------------------------------------------------------------------
create or replace view v_test_history as
select
  s.id            as selection_id,
  e.tag_id,
  e.full_name,
  e.department,
  c.cycle_number,
  s.selected_at,
  s.status,
  s.tested_at,
  s.result,
  s.notes
from test_selections s
join employees e on e.id = s.employee_id
join test_cycles c on c.id = s.cycle_id;
