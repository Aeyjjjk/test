# Wact DA Test

An admin tool for running compliant random selection of employees for
drug/alcohol testing, tracking who's been drawn, and exporting reports.

## What it does

- **Random draw**: draws 2–5 employees per round (your choice each time),
  preferring a spread across departments, and only from people currently
  **on duty** per their shift schedule. A passed ("negative") result sends
  someone back into the pool right away rather than waiting for the whole
  roster to be covered — but with reduced (not zero) odds of being redrawn
  for the next 4 rounds, so a clean record isn't a free pass forever.
  Confirming the draw shows a blurred-backdrop popup listing everyone
  selected — it stays open until the admin clicks Confirm.
- **Shift scheduling**: every employee belongs to Shift A, B, C, or D. A and B
  rotate on a 6-day pattern — 2 mornings, 2 nights, 2 off — offset from each
  other so coverage overlaps; C and D work Day only (8am–5pm), every day. The
  app computes who's on duty right now from the current time, and the draw
  pulls only from that group. Shift hours/offsets are a starting assumption —
  see the note in `supabase/shift_and_cooldown_update.sql` if your actual
  schedule differs.
- **Admin dashboard**: active/on-duty counts, pending-result count, rounds
  run, a 14-day trend chart, a department breakdown chart, and a table of
  recent draws where you can mark each as tested / no-show / excused.
- **Employee roster**: add/edit/deactivate employees one at a time, or bulk
  import via CSV (`tag_id, full_name, department, email, phone, shift_group`).
  Sortable by Tag ID (default), name, department, or status. Shows each
  person's shift and whether they're on duty right now. Export the current
  roster to CSV any time. Card-based layout on phones instead of a cramped
  table. Select employees and delete them in bulk (with a confirmation, since
  it also removes their test history).
- **Exports**: three separate CSV exports — tested, pending, and not tested —
  each for a daily, weekly, monthly, or yearly window.
- **Activity log**: every draw, roster edit, and bulk action — exportable to
  CSV.
- **Employee status check** (`/status`): an employee types their Tag ID and
  sees whether they're currently due for testing — no login needed.
- **Testing board** (`/board`): a kiosk-style screen listing everyone
  currently due, meant to run on a shared display. Auto-refreshes every 20
  seconds. Never shows test results — only name, department, and "report now."
- **Welcome screen** (`/`): a splash page with a Continue button leading to
  the employee menu (`/menu`) — status check, testing board, admin sign-in.
- **Admin area** (`/admin`): dashboard, employees, exports, logs — all
  behind sign-in. Create admin accounts directly in Supabase Authentication;
  there's no self-signup. A "User view" link in the sidebar jumps straight to
  the employee menu in a new tab.
- **Light / dark mode**: a toggle on every screen; the choice is remembered
  per browser.
- Fully responsive, from phone widths up through large desktop screens.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in the contents of `supabase/schema.sql`, and
   run it. This creates the tables, the reporting view, and row-level
   security policies.
3. Run `supabase/grants.sql` — grants the `authenticated` role permission to
   use those tables (RLS alone isn't enough; Postgres needs an explicit GRANT
   too).
4. Run `supabase/public_functions.sql` — adds `get_employee_status()` and
   `get_call_board()`, the two functions the public `/status` and `/board`
   pages call. Both are scoped to return only name/department/status, never
   test results, and are granted to the `anon` role since employees don't log in.
5. Run `supabase/shift_and_cooldown_update.sql` — adds the shift-group model
   (`shift_groups` table, `shift_phase()` function, `v_employee_shift_now`
   view) and replaces `run_selection()` with the cooldown-weighted version
   described above. **Check the shift hours/offsets at the top of this file
   against your actual schedule before relying on it** — they're a
   best-guess default (A/B: 6am–6pm morning, 6pm–6am night, offset 3 days;
   C/D: 8am–5pm every day).
6. Open **Authentication > Users** and add an admin user (email + password).
   Repeat for each admin.
7. Open **Project Settings > API** and copy the **Project URL** and
   **anon public key**.

## 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run it locally

```bash
npm install
npm run dev
```

Visit the printed local URL and sign in with the admin account you created.

## 4. Deploy

Build a static bundle and host it anywhere (Vercel, Netlify, Cloudflare
Pages, S3 + CloudFront, etc.):

```bash
npm run build
```

The output is in `dist/`. Set the two `VITE_SUPABASE_*` environment variables
in your hosting provider's dashboard the same way as in `.env`.

## Notes on the selection logic

- The draw is done inside a single Postgres function (`run_selection`), so
  the "who's left to test" state lives in the database, not in the browser —
  it's safe even if two admins are using the app at once.
- Cycle history is never deleted, so the exports and activity log always
  reflect real history across every cycle, not just the current one.
- To change the department-diversity rule or draw size defaults, edit
  `run_selection()` in `supabase/schema.sql` and re-run just that function
  definition in the SQL editor.

## CSV format for bulk employee import

```
tag_id,full_name,department,email,phone
E-1042,Alicia Owens,Warehouse,alicia@company.com,555-0142
E-1043,Daniel Reyes,Logistics,daniel@company.com,555-0143
```

`tag_id` must be unique — re-uploading a CSV with an existing tag ID updates
that employee's record instead of duplicating it.
