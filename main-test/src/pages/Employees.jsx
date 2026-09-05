import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { toCsv, downloadCsv } from '../lib/csv.js';

const EMPTY_FORM = { tag_id: '', full_name: '', department: '', email: '', phone: '', shift_group: 'C' };
const SHIFT_OPTIONS = [
  { value: 'A', label: 'A — rotating (morning/night)' },
  { value: 'B', label: 'B — rotating (morning/night)' },
  { value: 'C', label: 'C — day only' },
  { value: 'D', label: 'D — day only' }
];

export default function Employees() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('tag_id');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [shiftStatus, setShiftStatus] = useState({}); // employee_id -> { label, on_duty }
  const fileRef = useRef(null);

  async function loadShiftStatus() {
    const { data } = await supabase.from('v_employee_shift_now').select('employee_id, label, on_duty');
    const map = {};
    (data ?? []).forEach((r) => { map[r.employee_id] = { label: r.label, on_duty: r.on_duty }; });
    setShiftStatus(map);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').order('full_name');
    setRows(data ?? []);
    setLoading(false);
    loadShiftStatus();
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.tag_id || !form.full_name || !form.department) {
      setError('Tag ID, name, and department are required.');
      return;
    }
    const payload = { ...form };
    const { error: err } = editingId
      ? await supabase.from('employees').update(payload).eq('id', editingId)
      : await supabase.from('employees').insert(payload);
    if (err) {
      setError(err.message.includes('duplicate') ? 'That tag ID is already in use.' : err.message);
      return;
    }
    await supabase.from('activity_logs').insert({
      action: editingId ? 'employee_updated' : 'employee_added',
      details: { tag_id: form.tag_id, full_name: form.full_name }
    });
    resetForm();
    load();
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      tag_id: row.tag_id, full_name: row.full_name, department: row.department,
      email: row.email ?? '', phone: row.phone ?? '', shift_group: row.shift_group ?? 'C'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleActive(row) {
    await supabase.from('employees').update({ active: !row.active }).eq('id', row.id);
    await supabase.from('activity_logs').insert({
      action: row.active ? 'employee_deactivated' : 'employee_activated',
      details: { tag_id: row.tag_id }
    });
    load();
  }

  async function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('Reading file…');

    try {
      let text = await file.text();
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM if present

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setUploadMsg('CSV needs a header row plus at least one employee.');
        return;
      }

      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const idx = {
        tag_id: header.indexOf('tag_id'),
        full_name: header.indexOf('full_name'),
        department: header.indexOf('department'),
        email: header.indexOf('email'),
        phone: header.indexOf('phone'),
        shift_group: header.indexOf('shift_group')
      };
      if (idx.tag_id === -1 || idx.full_name === -1 || idx.department === -1) {
        setUploadMsg('CSV header must include at least: tag_id, full_name, department.');
        return;
      }

      const validShifts = new Set(['A', 'B', 'C', 'D']);
      const parsed = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        const rawShift = idx.shift_group > -1 ? (cols[idx.shift_group] || '').toUpperCase() : '';
        return {
          tag_id: cols[idx.tag_id] || '',
          full_name: cols[idx.full_name] || '',
          department: cols[idx.department] || '',
          email: idx.email > -1 ? (cols[idx.email] || null) : null,
          phone: idx.phone > -1 ? (cols[idx.phone] || null) : null,
          shift_group: validShifts.has(rawShift) ? rawShift : 'C'
        };
      }).filter((r) => r.tag_id && r.full_name && r.department);

      if (parsed.length === 0) {
        setUploadMsg('No valid rows found. Check that every row has a tag ID, name, and department.');
        return;
      }

      // De-duplicate by tag_id — Postgres rejects an upsert batch that
      // targets the same conflict key twice. Keep the last occurrence,
      // since that's usually the most up-to-date row in the file.
      const byTagId = new Map();
      parsed.forEach((r) => byTagId.set(r.tag_id.toLowerCase(), r));
      const records = Array.from(byTagId.values());
      const duplicateCount = parsed.length - records.length;

      const { error: err } = await supabase.from('employees').upsert(records, { onConflict: 'tag_id' });
      if (err) {
        setUploadMsg(`Upload failed: ${err.message}`);
        return;
      }

      await supabase.from('activity_logs').insert({
        action: 'employees_bulk_uploaded',
        details: { count: records.length, duplicates_skipped: duplicateCount }
      });
      setUploadMsg(
        duplicateCount > 0
          ? `Imported ${records.length} employee(s). Skipped ${duplicateCount} duplicate tag ID row(s) — the last occurrence of each was used.`
          : `Imported ${records.length} employee(s).`
      );
      load();
    } catch (err) {
      setUploadMsg(`Couldn't read that file: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleExportRoster() {
    const csv = toCsv(filtered, [
      { label: 'Tag ID', value: (r) => r.tag_id },
      { label: 'Name', value: (r) => r.full_name },
      { label: 'Department', value: (r) => r.department },
      { label: 'Shift', value: (r) => r.shift_group },
      { label: 'Email', value: (r) => r.email ?? '' },
      { label: 'Phone', value: (r) => r.phone ?? '' },
      { label: 'Status', value: (r) => (r.active ? 'Active' : 'Inactive') }
    ]);
    downloadCsv(`employees_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const allVisibleSelected = filtered.length > 0 && filtered.every((r) => prev.has(r.id));
      if (allVisibleSelected) return new Set();
      return new Set(filtered.map((r) => r.id));
    });
  }

  async function handleDeleteSelected() {
    const targets = rows.filter((r) => selectedIds.has(r.id));
    if (targets.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${targets.length} employee(s)? This also permanently deletes their test history and cannot be undone.\n\n` +
      `If they've simply left the company, consider Deactivate instead.`
    );
    if (!confirmed) return;

    setDeleting(true);
    const { error: err } = await supabase.from('employees').delete().in('id', Array.from(selectedIds));
    setDeleting(false);

    if (err) {
      window.alert(`Delete failed: ${err.message}`);
      return;
    }

    await supabase.from('activity_logs').insert({
      action: 'employees_deleted',
      details: { count: targets.length, tag_ids: targets.map((t) => t.tag_id) }
    });
    setSelectedIds(new Set());
    load();
  }

  const filtered = rows
    .filter((r) => {
      const q = search.toLowerCase();
      return !q || r.full_name.toLowerCase().includes(q) || r.tag_id.toLowerCase().includes(q) || r.department.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'status') return Number(b.active) - Number(a.active);
      return String(a[sortBy]).localeCompare(String(b[sortBy]), undefined, { numeric: true });
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-head font-extrabold text-2xl text-ink">Employees</h1>
        <p className="text-muted text-sm mt-1">Manage the roster the random draw pulls from.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={handleSubmit} className="lg:col-span-1 bg-surface border border-line rounded-lg p-5 space-y-3 h-fit">
          <p className="font-head font-bold text-ink">{editingId ? 'Edit employee' : 'Add employee'}</p>
          {['tag_id', 'full_name', 'department', 'email', 'phone'].map((field) => (
            <div key={field}>
              <label className="block text-xs text-muted mb-1 capitalize">{field.replace('_', ' ')}</label>
              <input
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                required={['tag_id', 'full_name', 'department'].includes(field)}
                className="w-full bg-raised border border-line rounded-md px-3 py-2 text-sm text-ink outline-none focus:border-orange"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-muted mb-1">Shift</label>
            <select
              value={form.shift_group}
              onChange={(e) => setForm((f) => ({ ...f, shift_group: e.target.value }))}
              className="w-full bg-raised border border-line rounded-md px-3 py-2 text-sm text-ink outline-none focus:border-orange"
            >
              {SHIFT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-alert text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex-1 bg-orange hover:bg-orange/90 text-inkOnOrange font-head font-bold rounded-md py-2 text-sm transition-colors">
              {editingId ? 'Save changes' : 'Add employee'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-muted text-sm hover:text-ink px-3">
                Cancel
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-line">
            <p className="text-xs text-muted mb-2">
              Or bulk import a CSV with header: tag_id, full_name, department, email, phone, shift_group
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="w-full bg-raised border border-line hover:border-orange disabled:opacity-60 text-ink font-medium rounded-md py-2 text-sm transition-colors"
            >
              {uploading ? 'Importing…' : 'Choose CSV file'}
            </button>
            {uploadMsg && <p className="text-xs text-orange-soft mt-2">{uploadMsg}</p>}
          </div>
        </form>

        <div className="lg:col-span-2 bg-surface border border-line rounded-lg p-5">
          <div className="flex flex-col gap-3 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, tag ID, or department"
              className="w-full bg-raised border border-line rounded-md px-3 py-2 text-sm text-ink placeholder:text-muted/60 outline-none focus:border-orange"
            />
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 bg-raised border border-line rounded-md px-3 py-2 text-sm text-ink outline-none focus:border-orange"
              >
                <option value="tag_id">Sort by Tag ID</option>
                <option value="full_name">Sort by Name</option>
                <option value="department">Sort by Department</option>
                <option value="status">Sort by Status</option>
              </select>
              <button
                onClick={handleExportRoster}
                disabled={filtered.length === 0}
                className="shrink-0 bg-raised border border-line hover:border-orange disabled:opacity-60 text-ink text-sm font-medium rounded-md px-3 py-2 transition-colors"
              >
                Export
              </button>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between bg-alert/10 border border-alert/40 rounded-md px-3 py-2">
                <span className="text-alert text-sm">{selectedIds.size} selected</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedIds(new Set())} className="text-muted text-sm hover:text-ink">
                    Clear
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="bg-alert hover:bg-alert/90 disabled:opacity-60 text-white text-sm font-medium rounded-md px-3 py-1.5 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Delete selected'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {!loading && filtered.length === 0 && (
            <p className="text-center text-muted text-sm py-8">No employees found.</p>
          )}

          {filtered.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted mb-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={filtered.every((r) => selectedIds.has(r.id))}
                onChange={toggleSelectAllVisible}
                className="accent-orange"
              />
              Select all
            </label>
          )}

          {/* Mobile: stacked cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map((r) => {
              const status = shiftStatus[r.id];
              return (
                <div key={r.id} className="bg-raised border border-line rounded-md p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="accent-orange mt-1"
                      />
                      <div>
                        <p className="text-ink font-medium">{r.full_name}</p>
                        <p className="text-muted text-xs font-mono mt-0.5">{r.tag_id}</p>
                      </div>
                    </div>
                    <span className={`text-xs shrink-0 ${r.active ? 'text-pass' : 'text-muted'}`}>
                      {r.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-muted text-sm mt-1 ml-6">{r.department}</p>
                  <div className="flex items-center gap-2 mt-1 ml-6">
                    <span className="text-xs text-muted">Shift {r.shift_group}</span>
                    {status && (
                      <span className={`text-xs flex items-center gap-1 ${status.on_duty ? 'text-pass' : 'text-muted'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.on_duty ? 'bg-pass' : 'bg-muted'}`} />
                        {status.label}{status.on_duty ? ' · on duty' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 ml-6">
                    <button onClick={() => startEdit(r)} className="text-orange-soft text-xs font-medium">Edit</button>
                    <button onClick={() => toggleActive(r)} className="text-muted text-xs font-medium">
                      {r.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop / tablet: table */}
          <div className="hidden sm:block overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-muted text-left border-b border-line">
                  <th className="px-5 py-2 font-medium w-8"></th>
                  <th className="px-5 py-2 font-medium">Tag ID</th>
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-5 py-2 font-medium">Department</th>
                  <th className="px-5 py-2 font-medium">Shift</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const status = shiftStatus[r.id];
                  return (
                    <tr key={r.id} className="border-b border-line/60 last:border-0">
                      <td className="px-5 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="accent-orange"
                        />
                      </td>
                      <td className="px-5 py-2.5 text-ink font-mono text-xs">{r.tag_id}</td>
                      <td className="px-5 py-2.5 text-ink">{r.full_name}</td>
                      <td className="px-5 py-2.5 text-muted">{r.department}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-ink text-xs">{r.shift_group}</span>
                          {status && (
                            <span className={`text-xs flex items-center gap-1 ${status.on_duty ? 'text-pass' : 'text-muted'}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${status.on_duty ? 'bg-pass' : 'bg-muted'}`} />
                              {status.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={r.active ? 'text-pass' : 'text-muted'}>{r.active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => startEdit(r)} className="text-orange-soft hover:underline mr-3 text-xs">Edit</button>
                        <button onClick={() => toggleActive(r)} className="text-muted hover:text-ink text-xs">
                          {r.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
