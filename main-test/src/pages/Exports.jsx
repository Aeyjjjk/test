import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { toCsv, downloadCsv as download } from '../lib/csv.js';

const RANGES = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365
};

const EXPORT_TYPES = [
  { key: 'tested', label: 'Export tested', tone: 'orange' },
  { key: 'pending', label: 'Export pending', tone: 'neutral' },
  { key: 'not_tested', label: 'Export not tested', tone: 'neutral' }
];

export default function Exports() {
  const [range, setRange] = useState('weekly');
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState('');

  async function runExport(kind) {
    setBusyKey(kind);
    setMessage('');

    const since = new Date();
    since.setDate(since.getDate() - RANGES[range]);

    if (kind === 'tested' || kind === 'pending') {
      const status = kind === 'tested' ? 'tested' : 'pending';
      const { data, error: err } = await supabase
        .from('v_test_history')
        .select('tag_id, full_name, department, selected_at, status, result, cycle_number')
        .eq('status', status)
        .gte('selected_at', since.toISOString())
        .order('selected_at', { ascending: false });

      if (err) {
        setMessage(`Export failed: ${err.message}`);
        setBusyKey(null);
        return;
      }

      const columns = [
        { label: 'Tag ID', value: (r) => r.tag_id },
        { label: 'Name', value: (r) => r.full_name },
        { label: 'Department', value: (r) => r.department },
        { label: 'Selected at', value: (r) => new Date(r.selected_at).toLocaleString() },
        { label: 'Round', value: (r) => r.cycle_number }
      ];
      if (kind === 'tested') {
        columns.push({ label: 'Result', value: (r) => r.result ?? '' });
      }

      download(`${kind}_${range}_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data ?? [], columns));
      setMessage(`Exported ${data?.length ?? 0} ${kind === 'tested' ? 'tested' : 'pending'} record(s) for the last ${range === 'daily' ? '24 hours' : range} window.`);
      setBusyKey(null);
      return;
    }

    // not_tested: active employees with zero selection record in the window
    const [{ data: allEmployees, error: empErr }, { data: history, error: histErr }] = await Promise.all([
      supabase.from('employees').select('tag_id, full_name, department, active'),
      supabase.from('v_test_history').select('tag_id').gte('selected_at', since.toISOString())
    ]);

    if (empErr || histErr) {
      setMessage(`Export failed: ${(empErr || histErr).message}`);
      setBusyKey(null);
      return;
    }

    const drawnTagIds = new Set((history ?? []).map((h) => h.tag_id));
    const untested = (allEmployees ?? []).filter((e) => e.active && !drawnTagIds.has(e.tag_id));

    download(
      `not_tested_${range}_${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(untested, [
        { label: 'Tag ID', value: (r) => r.tag_id },
        { label: 'Name', value: (r) => r.full_name },
        { label: 'Department', value: (r) => r.department }
      ])
    );
    setMessage(`Exported ${untested.length} active employee(s) not drawn in that window.`);
    setBusyKey(null);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-head font-extrabold text-2xl text-ink">Exports</h1>
        <p className="text-muted text-sm mt-1">Download tested, pending, or not-tested employees for any period.</p>
      </div>

      <div className="bg-surface border border-line rounded-lg p-5 space-y-5">
        <div>
          <p className="text-sm text-muted mb-2">Time window</p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(RANGES).map((key) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={[
                  'px-3 py-1.5 rounded-md text-sm capitalize border transition-colors',
                  range === key
                    ? 'bg-orange-dim border-orange text-orange-soft'
                    : 'bg-raised border-line text-muted hover:text-ink'
                ].join(' ')}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-muted mb-2">Choose one export</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {EXPORT_TYPES.map((t) => (
              <button
                key={t.key}
                disabled={busyKey !== null}
                onClick={() => runExport(t.key)}
                className={[
                  'font-head font-bold rounded-md py-2.5 text-sm transition-colors disabled:opacity-60',
                  t.tone === 'orange'
                    ? 'bg-orange hover:bg-orange/90 text-inkOnOrange'
                    : 'bg-raised border border-line hover:border-orange text-ink'
                ].join(' ')}
              >
                {busyKey === t.key ? 'Exporting…' : t.label}
              </button>
            ))}
          </div>
        </div>

        {message && <p className="text-sm text-muted">{message}</p>}
      </div>
    </div>
  );
}
