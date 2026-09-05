import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle.jsx';
import logoFull from '../assets/logo-full.png';

export default function Welcome() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-bg relative overflow-hidden flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Ambient glow — purely decorative, sits behind everything */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <div className="h-[420px] w-[420px] rounded-full bg-orange/20 blur-[120px]" />
      </div>
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-orange/10 blur-[100px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-orange/10 blur-[100px]" aria-hidden="true" />

      <div
        className={[
          'relative text-center max-w-md transition-all duration-700 ease-out',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        ].join(' ')}
      >
        <div className="mx-auto mb-6 inline-block bg-white rounded-2xl px-6 py-5 shadow-[0_0_60px_-10px_rgba(255,122,41,0.45)]">
          <img src={logoFull} alt="Wact" className="h-16 sm:h-20 w-auto" />
        </div>

        <p className="text-muted mt-1 text-base sm:text-lg">
          Fair, random, and transparent testing — every time.
        </p>

        <button
          onClick={() => navigate('/menu')}
          className="group mt-10 inline-flex items-center gap-2 bg-orange hover:bg-orange/90 text-inkOnOrange font-head font-bold rounded-full px-8 py-3.5 text-base transition-all hover:shadow-[0_0_40px_-8px_rgba(255,122,41,0.65)]"
        >
          Continue
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className="transition-transform group-hover:translate-x-1"
          >
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <p className="text-muted text-xs mt-8">Random Drug &amp; Alcohol Testing Program</p>
      </div>
    </div>
  );
}
