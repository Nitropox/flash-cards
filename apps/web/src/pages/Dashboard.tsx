import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDueCount, getStreak, isEveningSession } from '../lib/session';
import { seedIfEmpty } from '../lib/seed';
import { db } from '../lib/db';
import type { Settings } from '../lib/types';

export function Dashboard() {
  const navigate = useNavigate();
  const [due, setDue] = useState(0);
  const [newAvailable, setNewAvailable] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const evening = isEveningSession();

  useEffect(() => {
    async function init() {
      const existing = await db.settings.get('current');
      if (!existing) {
        navigate('/onboarding');
        return;
      }

      await seedIfEmpty();
      setSettings(existing as Settings);
      const counts = await getDueCount();
      setDue(counts.due);
      setNewAvailable(counts.newAvailable);
      const s = await getStreak();
      setStreak(s);

      await checkRecommendation(existing as Settings);
      setLoading(false);
    }
    init();
  }, [navigate]);

  async function checkRecommendation(s: Settings) {
    const tierCards = await db.cards
      .filter(c => c.direction === 'pt_to_pl' && !c.suspended)
      .toArray();

    const tierWordIds = new Set(
      (await db.words.where('tier').belowOrEqual(s.currentTier).toArray()).map(w => w.id)
    );
    const relevant = tierCards.filter(c => tierWordIds.has(c.wordId));
    if (relevant.length === 0) return;

    const inReview = relevant.filter(c => c.state === 'Review' || c.stability > 90);
    const pct = inReview.length / relevant.length;
    const avgStability = inReview.length > 0
      ? inReview.reduce((sum, c) => sum + c.stability, 0) / inReview.length
      : 0;

    if (pct >= 0.8 && avgStability >= 21) {
      const nextTiers: Record<number, number> = { 10: 100, 100: 300, 300: 500, 500: 1000, 1000: 3000, 3000: 10000 };
      const next = nextTiers[s.currentTier];
      if (next) {
        setRecommendation(`You're cruising through Tier ${s.currentTier}. Ready for Tier ${next}?`);
      }
    }
  }

  if (loading) {
    return <div className="text-center text-stone-400 mt-20">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {recommendation && (
        <div className="w-full bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-green-700 dark:text-green-300">{recommendation}</p>
          <Link to="/settings" className="text-sm font-medium text-green-700 dark:text-green-300 hover:underline ml-4 shrink-0">
            Advance
          </Link>
        </div>
      )}

      <h1 className="text-4xl font-bold">pt-cards</h1>

      <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
        <span className="text-2xl">🔥</span>
        <span className="text-lg font-medium">{streak} day streak</span>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-xl p-6 w-full shadow-sm border border-stone-200 dark:border-stone-800">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium px-2 py-0.5 rounded ${evening ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'}`}>
            {evening ? 'Evening session' : 'Morning session'}
          </span>
        </div>
        <p className="text-stone-600 dark:text-stone-300">
          <strong>{due}</strong> reviews due
          {!evening && <>, <strong>{newAvailable}</strong> new cards available</>}
        </p>
        {evening && (
          <p className="text-xs text-stone-400 mt-2">New cards are reserved for morning sessions.</p>
        )}
      </div>

      <span className="inline-block bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-medium px-3 py-1 rounded-full">
        Tier {settings?.currentTier ?? 100}
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
