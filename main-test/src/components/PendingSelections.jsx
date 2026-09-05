import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const STATUS_OPTIONS = ['pending', 'tested', 'no_show', 'excused'];

export default function PendingSelections({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [sortBy, setSortBy] = useState('drawn');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('v_test_history')
      .select('*')
      .order('selected_at', { ascending: false })
      .limit(25);
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [refreshKey]);

  async function updateStatus(selectionId, status) {
    setSavingId(selectionId);
    const patch = { status };
    if (status === 'tested') patch.tested_at = new Date().toISOString();
    await supabase.from('test_selections').update(patch).eq('id', selectionId);
    await supabase.from('activity_logs').insert({
      action: 'status_updated',
      details: { selection_id: selectionId, status }
    });
    setSavingId(null);
    load();
  }

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'department') return a.department.localeCompare(b.department);
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    return new Date(b.selected_at) - new Date(a.selected_at); // drawn (default): most recent first
  });

  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="font-head font-bold text-ink">Recent draws</p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-raised border border-line rounded-md px-2.5 py-1.5 text-xs text-ink outline-none focus:border-orange"
        >
          <option value="drawn">Sort: Time drawn</option>
          <option value="department">Sort: Department</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-muted text-left border-b border-line">
              <th className="px-5 py-2 font-medium">Name</th>
              <th className="px-5 py-2 font-medium">Department</th>
              <th className="px-5 py-2 font-medium">Drawn</th>
              <th className="px-5 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-muted">No draws yet.</td></tr>
            )}
            {sorted.map((r) => (
              <tr key={r.selection_id} className="border-b border-line/60 last:border-0">
                <td className="px-5 py-2.5 text-ink">{r.full_name}</td>
                <td className="px-5 py-2.5 text-muted">{r.department}</td>
                <td className="px-5 py-2.5 text-muted">{new Date(r.selected_at).toLocaleDateString()}</td>
                <td className="px-5 py-2.5">
                  <select
                    value={r.status}
                    disabled={savingId === r.selection_id}
                    onChange={(e) => updateStatus(r.selection_id, e.target.value)}
                    className={[
                      'bg-raised border border-line rounded-md px-2 py-1 text-xs outline-none focus:border-orange',
                      r.status === 'tested' ? 'text-pass' : r.status === 'no_show' ? 'text-alert' : 'text-pending'
                    ].join(' ')}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
