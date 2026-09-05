import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/useAuth.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import logoFull from '../assets/logo-full.png';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/employees', label: 'Employees' },
  { to: '/admin/exports', label: 'Exports' },
  { to: '/admin/logs', label: 'Activity log' }
];

function linkClass({ isActive }) {
  return [
    'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
    isActive ? 'bg-orange-dim text-orange-soft' : 'text-muted hover:text-ink hover:bg-raised'
  ].join(' ');
}

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/admin/login');
  }

  const Sidebar = (
    <nav className="flex flex-col h-full">
      <div className="flex items-center px-4 h-16 border-b border-line">
        <div className="bg-white rounded-lg px-2.5 py-1.5">
          <img src={logoFull} alt="Wact" className="h-6 w-auto" />
        </div>
      </div>
      <div className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={() => setNavOpen(false)}>
            {item.label}
          </NavLink>
        ))}
        <a
          href="/menu"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-muted hover:text-ink hover:bg-raised transition-colors"
        >
          User view
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
      <div className="px-4 py-4 border-t border-line">
        <p className="text-xs text-muted truncate mb-2">{user?.email}</p>
        <div className="flex items-center justify-between">
          <button
            onClick={handleLogout}
            className="text-sm text-muted hover:text-alert transition-colors"
          >
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg lg:flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-60 shrink-0 bg-surface border-r border-line">
        {Sidebar}
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-line bg-surface sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="bg-white rounded-md px-2 py-1">
            <img src={logoFull} alt="Wact" className="h-4 w-auto" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="text-ink p-2"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-surface border-r border-line">
            {Sidebar}
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
