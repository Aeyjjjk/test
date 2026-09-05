import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle.jsx';
import logoFull from '../assets/logo-full.png';

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <div className="bg-white rounded-xl px-4 py-3">
            <img src={logoFull} alt="Wact" className="h-10 w-auto" />
          </div>
        </div>

        <div className="space-y-3">
          <Link
            to="/status"
            className="block bg-orange hover:bg-orange/90 text-inkOnOrange font-head font-bold rounded-md py-3 transition-colors"
          >
            Check my status
          </Link>
          <Link
            to="/board"
            className="block bg-surface border border-line hover:border-orange text-ink font-head font-bold rounded-md py-3 transition-colors"
          >
            View testing board
          </Link>
          <Link
            to="/admin/login"
            className="block text-muted hover:text-ink text-sm pt-2"
          >
            Admin sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}
