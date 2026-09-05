import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { toCsv, downloadCsv } from '../lib/csv.js';

function describe(log) {
  const d = log.details ?? {};
  switch (log.action) {
    case 'cycle_started': return `Cycle #${d.cycle_number} started`;
    case 'cycle_completed': return `Cycle #${d.cycle_number} completed — everyone drawn`;
    case 'selection_run': return `Drew ${d.count} employee(s) in round #${d.cycle_number}`;
    case 'status_updated': return `Marked a draw as "${String(d.status).replace('_', ' ')}"`;
    case 'employee_added': return `Added employee ${d.full_name} (${d.tag_id})`;
    case 'employee_updated': return `Updated employee ${d.full_name} (${d.tag_id})`;
    case 'employee_deactivated': return `Deactivated tag ${d.tag_id}`;
    case 'employee_activated': return `Reactivated tag ${d.tag_id}`;
    case 'employees_deleted': return `Deleted ${d.count} employee(s): ${(d.tag_ids || []).join(', ')}`;
    case 'employees_bulk_uploaded':
      return d.duplicates_skipped
        ? `Bulk imported ${d.count} employees (skipped ${d.duplicates_skipped} duplicate tag ID row(s))`
        : `Bulk imported ${d.count} employees`;
    default: return log.action;
  }
}

export default function Logs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleExport() {
    const csv = toCsv(rows, [
      { label: 'Date', value: (r) => new Date(r.created_at).toLocaleString() },
      { label: 'Action', value: (r) => r.action },
      { label: 'Details', value: (r) => describe(r) },
      { label: 'Actor', value: (r) => r.actor }
    ]);
    downloadCsv(`activity_log_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-head font-extrabold text-2xl text-ink">Activity log</h1>
          <p className="text-muted text-sm mt-1">Every draw, cycle change, and roster edit, most recent first.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={rows.length === 0}
          className="bg-raised border border-line hover:border-orange disabled:opacity-60 text-ink font-head font-bold rounded-md px-4 py-2 text-sm transition-colors self-start"
        >
          Export logs (.csv)
        </button>
      </div>

      <div className="bg-surface border border-line rounded-lg divide-y divide-line/60">
        {loading && <p className="px-5 py-6 text-muted text-sm">Loading…</p>}
        {!loading && rows.length === 0 && <p className="px-5 py-6 text-muted text-sm">No activity yet.</p>}
        {rows.map((log) => (
          <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-4">
            <p className="text-sm text-ink">{describe(log)}</p>
            <p className="text-xs text-muted whitespace-nowrap">
              {new Date(log.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
