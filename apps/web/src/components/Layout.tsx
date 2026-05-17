import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../lib/useTheme';

export function Layout() {
  useTheme();

  const location = useLocation();
  const isSession = location.pathname === '/learn';

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      {!isSession && (
        <nav className="border-b border-stone-200 dark:border-stone-800 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to="/" className="block w-9 h-9 rounded-full border-4 border-white dark:border-stone-200 overflow-hidden shadow-sm shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <rect x="0" y="0" width="14" height="36" fill="#006600" />
                <rect x="14" y="0" width="22" height="36" fill="#FF0000" />
                <circle cx="14" cy="18" r="5.5" fill="#FFCC00" />
                <circle cx="14" cy="18" r="4" fill="#FF0000" />
                <rect x="12" y="15" width="4" height="6" rx="0.5" fill="#FFCC00" />
              </svg>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/browse" className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
                Browse
              </Link>
              <Link to="/stats" className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
                Stats
              </Link>
              <Link to="/settings" className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
                Settings
              </Link>
            </div>
          </div>
        </nav>
      )}
      <main className={`mx-auto px-4 py-8 ${isSession ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <Outlet />
      </main>
    </div>
  );
}
