import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { resetProgress } from '../lib/seed';
import type { Settings as SettingsType } from '../lib/types';

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.settings.get('current').then(s => {
      if (s) setSettings(s as SettingsType);
    });
  }, []);

  async function save(patch: Partial<SettingsType>) {
    if (!settings) return;
    const updated = { ...settings, ...patch };
    setSettings(updated);
    setSaving(true);
    await db.settings.put(updated);
    setSaving(false);
  }

  async function handleReset() {
    if (!confirm('This will erase all progress and re-seed tier 10. Are you sure?')) return;
    await resetProgress();
    window.location.href = '/';
  }

  if (!settings) return <div className="text-stone-400 mt-20 text-center">Loading...</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-stone-600 dark:text-stone-400">New cards per day</span>
          <input
            type="number"
            min={1}
            max={30}
            value={settings.newCardsPerDay}
            onChange={e => save({ newCardsPerDay: Math.min(30, Math.max(1, Number(e.target.value))) })}
            className="mt-1 block w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm text-stone-600 dark:text-stone-400">Max reviews per session</span>
          <input
            type="number"
            min={5}
            max={200}
            value={settings.maxReviewsPerSession}
            onChange={e => save({ maxReviewsPerSession: Math.min(200, Math.max(5, Number(e.target.value))) })}
            className="mt-1 block w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm text-stone-600 dark:text-stone-400">
            Target retention: {(settings.targetRetention * 100).toFixed(0)}%
          </span>
          <input
            type="range"
            min={80}
            max={97}
            value={settings.targetRetention * 100}
            onChange={e => save({ targetRetention: Number(e.target.value) / 100 })}
            className="mt-1 block w-full"
          />
        </label>

        <fieldset>
          <legend className="text-sm text-stone-600 dark:text-stone-400 mb-2">Theme</legend>
          <div className="flex gap-3">
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t}
                onClick={() => { save({ theme: t }); window.location.reload(); }}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
                  settings.theme === t
                    ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900'
                    : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {saving && <p className="text-xs text-stone-400">Saved</p>}

      <div className="pt-8 border-t border-stone-200 dark:border-stone-800">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Reset progress
        </button>
        <p className="text-xs text-stone-400 mt-2">Erases all cards and review history, re-seeds tier 10.</p>
      </div>
    </div>
  );
}
