import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { resetProgress } from '../lib/seed';
import { loadTierIntoDb, isTierAvailable } from '../lib/ingest';
import type { Settings as SettingsType } from '../lib/types';

type TierInfo = { tier: number; available: boolean; wordCount: number; cardStates: Record<string, number> };

const ALL_TIERS = [10, 100, 300, 500, 1000, 3000, 10000] as const;

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const s = await db.settings.get('current');
      if (s) setSettings(s as SettingsType);
      await loadTierInfo();
    }
    load();
  }, []);

  async function loadTierInfo() {
    const infos: TierInfo[] = [];
    for (const tier of ALL_TIERS) {
      const available = await isTierAvailable(tier);
      const wordsInTier = await db.words.where('tier').equals(tier).count();
      const cardsInTier = await db.cards.where('wordId').aboveOrEqual('').toArray();
      const tierWordIds = new Set(
        (await db.words.where('tier').equals(tier).toArray()).map(w => w.id)
      );
      const tierCards = cardsInTier.filter(c => tierWordIds.has(c.wordId) && c.direction === 'pt_to_pl');

      const states: Record<string, number> = {};
      for (const c of tierCards) {
        const key = c.suspended ? 'Suspended' : c.stability > 90 ? 'Mastered' : c.state;
        states[key] = (states[key] ?? 0) + 1;
      }

      infos.push({ tier, available, wordCount: wordsInTier, cardStates: states });
    }
    setTiers(infos);
  }

  async function save(patch: Partial<SettingsType>) {
    if (!settings) return;
    const updated = { ...settings, ...patch };
    setSettings(updated);
    setSaving(true);
    await db.settings.put(updated);
    setSaving(false);
  }

  async function advanceTier(tier: typeof ALL_TIERS[number]) {
    if (!confirm(`Add tier ${tier} words to your queue?`)) return;
    await loadTierIntoDb(tier);
    await save({ currentTier: tier });
    await loadTierInfo();
  }

  async function handleReset() {
    if (!confirm('This will erase all progress and re-seed. Are you sure?')) return;
    await resetProgress();
    window.location.href = '/';
  }

  if (!settings) return <div className="text-stone-400 mt-20 text-center">Loading...</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-stone-600 dark:text-stone-400">New cards per day (morning)</span>
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

      <div className="border-t border-stone-200 dark:border-stone-800 pt-6">
        <h2 className="text-lg font-semibold mb-3">Tiers</h2>
        <p className="text-sm text-stone-500 mb-4">Current tier: {settings.currentTier}</p>
        <div className="space-y-2">
          {tiers.map(t => {
            const isActive = t.tier <= settings.currentTier;
            const canAdvance = !isActive && t.available && t.tier === nextTier(settings.currentTier);
            const total = Object.values(t.cardStates).reduce((a, b) => a + b, 0);

            return (
              <div key={t.tier} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950' : 'border-stone-200 dark:border-stone-800'}`}>
                <div>
                  <span className="font-medium">Tier {t.tier}</span>
                  {isActive && total > 0 && (
                    <span className="text-xs text-stone-500 ml-2">
                      {t.cardStates['Review'] ?? 0} review, {t.cardStates['Mastered'] ?? 0} mastered, {t.cardStates['New'] ?? 0} new
                    </span>
                  )}
                  {!isActive && !t.available && (
                    <span className="text-xs text-stone-400 ml-2">not generated yet</span>
                  )}
                </div>
                {canAdvance && (
                  <button
                    onClick={() => advanceTier(t.tier as typeof ALL_TIERS[number])}
                    className="text-sm px-3 py-1 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 rounded-lg"
                  >
                    Unlock
                  </button>
                )}
                {isActive && <span className="text-xs text-green-600">active</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-6 border-t border-stone-200 dark:border-stone-800">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Reset progress
        </button>
        <p className="text-xs text-stone-400 mt-2">Erases all cards and review history, re-seeds.</p>
      </div>
    </div>
  );
}

function nextTier(current: number): number {
  const tiers = [10, 100, 300, 500, 1000, 3000, 10000];
  const idx = tiers.indexOf(current);
  return tiers[idx + 1] ?? 99999;
}
