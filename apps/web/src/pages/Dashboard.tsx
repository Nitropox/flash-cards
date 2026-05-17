import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDueCount, getStreak } from '../lib/session';
import { seedIfEmpty } from '../lib/seed';

export function Dashboard() {
  const [due, setDue] = useState(0);
  const [newAvailable, setNewAvailable] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      await seedIfEmpty();
      const counts = await getDueCount();
      setDue(counts.due);
      setNewAvailable(counts.newAvailable);
      const s = await getStreak();
      setStreak(s);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return <div className="text-center text-stone-400 mt-20">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-4xl font-bold">pt-cards</h1>

      <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
        <span className="text-2xl">🔥</span>
        <span className="text-lg font-medium">{streak} day streak</span>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-xl p-6 w-full shadow-sm border border-stone-200 dark:border-stone-800">
        <p className="text-stone-600 dark:text-stone-300">
          Today: <strong>{due}</strong> reviews due, <strong>{newAvailable}</strong> new cards available
        </p>
      </div>

      <span className="inline-block bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-medium px-3 py-1 rounded-full">
        Tier 10
      </span>

      <Link
        to="/learn"
        className="mt-4 px-10 py-4 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 rounded-xl text-lg font-semibold hover:opacity-90 transition-opacity"
      >
        Start session
      </Link>
    </div>
  );
}
