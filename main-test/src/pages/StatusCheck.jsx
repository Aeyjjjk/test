import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import logoFull from '../assets/logo-full.png';

export default function StatusCheck() {
  const [tagId, setTagId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // undefined = never searched
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!tagId.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);

    const { data, error: err } = await supabase.rpc('get_employee_status', { p_tag_id: tagId.trim() });
    setBusy(false);

    if (err) {
      setError('Something went wrong looking that up. Please try again.');
      return;
    }
    setResult(data?.[0] ?? { found: false });
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-4 py-10 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-white rounded-lg px-3 py-2">
            <img src={logoFull} alt="Wact" className="h-7 w-auto" />
          </div>
          <div>
            <p className="font-head font-bold text-ink leading-none">Wact DA Test</p>
            <p className="text-muted text-sm">Check your status</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5" htmlFor="tag">Your Tag ID</label>
            <input
              id="tag"
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              placeholder="e.g. E-1042"
              className="w-full bg-raised border border-line rounded-md px-3 py-2 text-ink placeholder:text-muted/60 focus:border-orange outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-orange hover:bg-orange/90 disabled:opacity-60 text-inkOnOrange font-head font-bold rounded-md py-2.5 transition-colors"
          >
            {busy ? 'Checking…' : 'Check status'}
          </button>
          {error && <p className="text-alert text-sm">{error}</p>}
        </form>

        {result && (
          <div className="mt-4 bg-surface border border-line rounded-lg p-6">
            {!result.found && (
              <p className="text-muted text-sm">
                We couldn't find that Tag ID. Double-check the number and try again.
              </p>
            )}

            {result.found && result.is_pending && (
              <>
                <span className="inline-block bg-orange-dim text-orange-soft text-xs font-medium px-2.5 py-1 rounded-full mb-3">
                  Testing required
                </span>
                <p className="font-head font-bold text-xl text-ink">{result.full_name}</p>
                <p className="text-muted text-sm mb-3">{result.department}</p>
                <p className="text-ink text-sm">
                  You were selected on {new Date(result.selected_at).toLocaleDateString()} (cycle #{result.cycle_number}).
                  Please report to your test coordinator as instructed.
                </p>
              </>
            )}

            {result.found && !result.is_pending && (
              <>
                <span className="inline-block bg-pass/10 text-pass text-xs font-medium px-2.5 py-1 rounded-full mb-3">
                  No test currently pending
                </span>
                <p className="font-head font-bold text-xl text-ink">{result.full_name}</p>
                <p className="text-muted text-sm mb-3">{result.department}</p>
                <p className="text-ink text-sm">
                  {result.selected_at
                    ? `Your most recent record was on ${new Date(result.selected_at).toLocaleDateString()}.`
                    : "You haven't been selected yet."}
                </p>
              </>
            )}
          </div>
        )}

        <p className="text-center text-muted text-xs mt-6">
          <Link to="/board" className="hover:text-ink underline">View the testing board</Link>
          {' · '}
          <Link to="/admin/login" className="hover:text-ink underline">Admin sign-in</Link>
        </p>
      </div>
    </div>
  );
}
