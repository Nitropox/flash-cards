import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { db } from '../lib/db';
import { getStreak } from '../lib/session';
import type { Card, ReviewLog, WordEntry } from '../lib/types';

type DayData = { date: string; again: number; hard: number; good: number; easy: number };
type RetentionData = { date: string; retention: number };

export function StatsPage() {
  const [streak, setStreak] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [trueRetention, setTrueRetention] = useState(0);
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [retentionData, setRetentionData] = useState<RetentionData[]>([]);
  const [heatmap, setHeatmap] = useState<number[][]>([]);
  const [hardestCards, setHardestCards] = useState<{ wordId: string; pt: string; pl: string; lapses: number }[]>([]);
  const [upcomingCards, setUpcomingCards] = useState<{ wordId: string; pt: string; pl: string; due: Date }[]>([]);

  useEffect(() => {
    async function load() {
      const s = await getStreak();
      setStreak(s);

      const cards = await db.cards.filter(c => !c.suspended).toArray();
      setTotalCards(cards.length);
      setMastered(cards.filter(c => c.stability > 90).length);

      const logs = await db.reviewLog.toArray();
      computeMetrics(logs, cards);
      computeDaily(logs);
      computeRetention(logs);
      computeHeatmap(logs);
      await computeHardest(cards);
      await computeUpcoming(cards);
    }
    load();
  }, []);

  function computeMetrics(logs: ReviewLog[], _cards: Card[]) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentLogs = logs.filter(l => l.reviewedAt > thirtyDaysAgo);
    const reviewLogs = recentLogs.filter(l => {
      return l.rating >= 1;
    });
    if (reviewLogs.length > 0) {
      const good = reviewLogs.filter(l => l.rating >= 3).length;
      setTrueRetention(Math.round((good / reviewLogs.length) * 100));
    }
  }

  function computeDaily(logs: ReviewLog[]) {
    const data: Record<string, DayData> = {};
    const thirtyDaysAgo = Date.now() - 30 * 86400000;

    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() - (29 - i) * 86400000);
      const key = d.toISOString().slice(5, 10);
      data[key] = { date: key, again: 0, hard: 0, good: 0, easy: 0 };
    }

    for (const log of logs) {
      if (log.reviewedAt.getTime() < thirtyDaysAgo) continue;
      const key = log.reviewedAt.toISOString().slice(5, 10);
      const entry = data[key];
      if (!entry) continue;
      if (log.rating === 1) entry.again++;
      else if (log.rating === 2) entry.hard++;
      else if (log.rating === 3) entry.good++;
      else if (log.rating === 4) entry.easy++;
    }

    setDailyData(Object.values(data));
  }

  function computeRetention(logs: ReviewLog[]) {
    const ninetyDaysAgo = Date.now() - 90 * 86400000;
    const byDay: Record<string, { good: number; total: number }> = {};

    for (const log of logs) {
      if (log.reviewedAt.getTime() < ninetyDaysAgo) continue;
      const key = log.reviewedAt.toISOString().slice(0, 10);
      if (!byDay[key]) byDay[key] = { good: 0, total: 0 };
      byDay[key]!.total++;
      if (log.rating >= 3) byDay[key]!.good++;
    }

    const days = Object.keys(byDay).sort();
    const result: RetentionData[] = [];
    for (let i = 6; i < days.length; i++) {
      const window = days.slice(i - 6, i + 1);
      let good = 0, total = 0;
      for (const d of window) {
        good += byDay[d]?.good ?? 0;
        total += byDay[d]?.total ?? 0;
      }
      if (total > 0) {
        result.push({ date: days[i]!.slice(5), retention: Math.round((good / total) * 100) });
      }
    }
    setRetentionData(result);
  }

  function computeHeatmap(logs: ReviewLog[]) {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    const thirtyDaysAgo = Date.now() - 30 * 86400000;

    for (const log of logs) {
      if (log.reviewedAt.getTime() < thirtyDaysAgo) continue;
      const day = log.reviewedAt.getDay();
      const hour = log.reviewedAt.getHours();
      grid[day]![hour]!++;
    }
    setHeatmap(grid);
  }

  async function computeHardest(cards: Card[]) {
    const sorted = [...cards].filter(c => c.lapses > 0).sort((a, b) => b.lapses - a.lapses).slice(0, 20);
    const results: { wordId: string; pt: string; pl: string; lapses: number }[] = [];
    for (const c of sorted) {
      const w = await db.words.get(c.wordId) as WordEntry | undefined;
      if (w) results.push({ wordId: w.id, pt: w.pt, pl: w.pl, lapses: c.lapses });
    }
    setHardestCards(results);
  }

  async function computeUpcoming(cards: Card[]) {
    const now = new Date();
    const sorted = [...cards].filter(c => c.state !== 'New' && c.due > now).sort((a, b) => a.due.getTime() - b.due.getTime()).slice(0, 20);
    const results: { wordId: string; pt: string; pl: string; due: Date }[] = [];
    for (const c of sorted) {
      const w = await db.words.get(c.wordId) as WordEntry | undefined;
      if (w) results.push({ wordId: w.id, pt: w.pt, pl: w.pl, due: c.due });
    }
    setUpcomingCards(results);
  }

  async function handleExport() {
    const data = {
      words: await db.words.toArray(),
      cards: await db.cards.toArray(),
      reviewLog: await db.reviewLog.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pt-cards-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!confirm('This will replace ALL local data. Continue?')) return;
      const text = await file.text();
      const data = JSON.parse(text);

      await db.transaction('rw', db.words, db.cards, db.reviewLog, db.settings, async () => {
        await db.words.clear();
        await db.cards.clear();
        await db.reviewLog.clear();
        await db.settings.clear();

        if (data.words) await db.words.bulkAdd(data.words);
        if (data.cards) {
          const cards = data.cards.map((c: Record<string, unknown>) => ({
            ...c,
            due: new Date(c['due'] as string),
            lastReview: c['lastReview'] ? new Date(c['lastReview'] as string) : undefined,
            introducedAt: c['introducedAt'] ? new Date(c['introducedAt'] as string) : undefined,
            masteredAt: c['masteredAt'] ? new Date(c['masteredAt'] as string) : undefined,
          }));
          await db.cards.bulkAdd(cards);
        }
        if (data.reviewLog) {
          const logs = data.reviewLog.map((l: Record<string, unknown>) => ({
            ...l,
            reviewedAt: new Date(l['reviewedAt'] as string),
          }));
          await db.reviewLog.bulkAdd(logs);
        }
        if (data.settings) await db.settings.bulkAdd(data.settings);
      });

      window.location.reload();
    };
    input.click();
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxHeat = Math.max(1, ...heatmap.flat());

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Stats</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800 text-center">
          <p className="text-3xl font-bold">{streak}</p>
          <p className="text-xs text-stone-500">Streak</p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800 text-center">
          <p className="text-3xl font-bold">{totalCards}</p>
          <p className="text-xs text-stone-500">Total cards</p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800 text-center">
          <p className="text-3xl font-bold">{mastered}</p>
          <p className="text-xs text-stone-500">Mastered</p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800 text-center">
          <p className="text-3xl font-bold">{trueRetention}%</p>
          <p className="text-xs text-stone-500">Retention (30d)</p>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
        <h3 className="text-sm font-medium text-stone-500 mb-3">Reviews per day (30 days)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dailyData}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="again" stackId="a" fill="#ef4444" />
            <Bar dataKey="hard" stackId="a" fill="#f59e0b" />
            <Bar dataKey="good" stackId="a" fill="#10b981" />
            <Bar dataKey="easy" stackId="a" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {retentionData.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-medium text-stone-500 mb-3">7-day rolling retention (90 days)</h3>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={retentionData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[50, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="retention" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {heatmap.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-medium text-stone-500 mb-3">Time of day heatmap (30 days)</h3>
          <div className="overflow-x-auto">
            <div className="grid grid-rows-7 gap-0.5" style={{ gridTemplateColumns: `40px repeat(24, 1fr)` }}>
              <div></div>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-[9px] text-stone-400 text-center">{h}</div>
              ))}
              {heatmap.map((row, day) => (
                <>
                  <div key={`label-${day}`} className="text-[10px] text-stone-400 pr-1 text-right leading-4">{dayNames[day]}</div>
                  {row.map((count, hour) => (
                    <div
                      key={`${day}-${hour}`}
                      className="w-full aspect-square rounded-sm"
                      style={{ backgroundColor: count === 0 ? 'var(--tw-color-stone-100, #f5f5f4)' : `rgba(16, 185, 129, ${Math.min(1, count / maxHeat)})` }}
                      title={`${dayNames[day]} ${hour}:00 — ${count} reviews`}
                    />
                  ))}
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      {hardestCards.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-medium text-stone-500 mb-3">Hardest cards</h3>
          <div className="space-y-1">
            {hardestCards.map(c => (
              <Link key={c.wordId} to={`/word/${c.wordId}`} className="flex justify-between text-sm hover:bg-stone-50 dark:hover:bg-stone-800 px-2 py-1 rounded">
                <span>{c.pt} — <span className="text-stone-500">{c.pl}</span></span>
                <span className="text-red-500">{c.lapses} lapses</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {upcomingCards.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-medium text-stone-500 mb-3">Upcoming reviews</h3>
          <div className="space-y-1">
            {upcomingCards.map(c => (
              <Link key={c.wordId} to={`/word/${c.wordId}`} className="flex justify-between text-sm hover:bg-stone-50 dark:hover:bg-stone-800 px-2 py-1 rounded">
                <span>{c.pt} — <span className="text-stone-500">{c.pl}</span></span>
                <span className="text-stone-400">{c.due.toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
        <button onClick={handleExport} className="px-4 py-2 text-sm bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg">
          Export data (JSON)
        </button>
        <button onClick={handleImport} className="px-4 py-2 text-sm bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg">
          Import data (JSON)
        </button>
      </div>
    </div>
  );
}
