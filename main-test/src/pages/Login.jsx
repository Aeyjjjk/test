import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import logoFull from '../assets/logo-full.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError('Sign-in failed. Check the email and password and try again.');
      return;
    }
    navigate('/admin');
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative">
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
            <p className="text-muted text-sm">Admin sign-in</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-raised border border-line rounded-md px-3 py-2 text-ink placeholder:text-muted/60 focus:border-orange outline-none"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-raised border border-line rounded-md px-3 py-2 text-ink placeholder:text-muted/60 focus:border-orange outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-alert text-sm">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-orange hover:bg-orange/90 disabled:opacity-60 text-inkOnOrange font-head font-bold rounded-md py-2.5 transition-colors"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-muted text-xs mt-4">
          Admin accounts are created in Supabase Authentication — this screen has no self-signup.
        </p>
        <p className="text-muted text-xs mt-2">
          <a href="/" className="hover:text-ink underline">Back to employee pages</a>
        </p>
      </div>
    </div>
  );
}
