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
            <Link to="/" className="text-lg font-semibold">pt-cards</Link>
            <div className="flex items-center gap-4">
              <Link to="/browse" className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
                Browse
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
