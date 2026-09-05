import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import logoFull from '../assets/logo-full.png';

const REFRESH_MS = 20000;

export default function CallBoard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  async function load() {
    const { data } = await supabase.rpc('get_call_board');
    setRows(data ?? []);
    setUpdatedAt(new Date());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-bg px-6 py-10 flex flex-col items-center relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-white rounded-lg px-3 py-2">
            <img src={logoFull} alt="Wact" className="h-8 w-auto" />
          </div>
          <div>
            <p className="font-head font-extrabold text-2xl text-ink leading-none">Testing Board</p>
            <p className="text-muted text-sm mt-1">Employees currently due for testing</p>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-lg divide-y divide-line/60 min-h-[200px]">
          {loading && <p className="px-6 py-8 text-muted text-sm">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="px-6 py-8 text-muted text-sm">No one is currently pending testing.</p>
          )}
          {rows.map((r, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-head font-bold text-lg text-ink">{r.full_name}</p>
                <p className="text-muted text-sm">{r.department}</p>
              </div>
              <span className="bg-orange-dim text-orange-soft text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap">
                Report now
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-muted text-xs mt-6">
          {updatedAt && `Updated ${updatedAt.toLocaleTimeString()} · refreshes automatically`}
        </p>
        <p className="text-center text-muted text-xs mt-2">
          <Link to="/status" className="hover:text-ink underline">Check my own status</Link>
        </p>
      </div>
    </div>
  );
}
