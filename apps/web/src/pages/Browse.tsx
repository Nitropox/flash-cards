import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { assetUrl } from '../lib/assets';
import { db } from '../lib/db';
import type { Card, WordEntry, Settings } from '../lib/types';

type WordWithState = WordEntry & { cardState: string; daysTillDue?: number };
type Filter = 'all' | 'New' | 'Learning' | 'Review' | 'Mastered' | 'Suspended';
type Sort = 'frequency' | 'alpha' | 'hardest';

export function BrowsePage() {
  const [words, setWords] = useState<WordWithState[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('frequency');
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTier, setSelectedTier] = useState<number>(0);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const s = await db.settings.get('current') as Settings | undefined;
      if (s) {
        setSettings(s);
        setSelectedTier(s.currentTier);
      }

      const allWords = await db.words.toArray();
      const allCards = await db.cards.toArray();
      const cardMap = new Map<string, Card>();
      for (const c of allCards) cardMap.set(c.id, c);

      const now = new Date();
      const enriched: WordWithState[] = allWords.map(w => {
        const ptCard = cardMap.get(`${w.id}:pt_to_pl`);
        let cardState = 'New';
        let daysTillDue: number | undefined;

        if (ptCard) {
          if (ptCard.suspended) {
            cardState = 'Suspended';
          } else if (ptCard.stability > 90) {
            cardState = 'Mastered';
          } else {
            cardState = ptCard.state;
            if (ptCard.state === 'Review' && ptCard.due > now) {
              daysTillDue = Math.ceil((ptCard.due.getTime() - now.getTime()) / 86400000);
            }
          }
        }

        return { ...w, cardState, daysTillDue };
      });

      setWords(enriched);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = words;

    if (selectedTier > 0) {
      result = result.filter(w => w.tier <= selectedTier);
    }

    if (filter !== 'all') {
      result = result.filter(w => w.cardState === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      result = result.filter(w => {
        const pt = w.pt.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const pl = w.pl.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        return pt.includes(q) || pl.includes(q);
      });
    }

    if (sort === 'frequency') result.sort((a, b) => a.frequencyRank - b.frequencyRank);
    else if (sort === 'alpha') result.sort((a, b) => a.pt.localeCompare(b.pt, 'pt'));
    else if (sort === 'hardest') result.sort((a, b) => (a.daysTillDue ?? 9999) - (b.daysTillDue ?? 9999));

    return result;
  }, [words, filter, sort, search, selectedTier]);

  const COLS = 4;
  const rowCount = Math.ceil(filtered.length / COLS);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  const filters: Filter[] = ['all', 'New', 'Learning', 'Review', 'Mastered', 'Suspended'];
  const tiers = [10, 100, 300, 500, 1000];

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={selectedTier}
          onChange={e => setSelectedTier(Number(e.target.value))}
          className="text-sm border border-stone-300 dark:border-stone-700 rounded-lg px-2 py-1 bg-white dark:bg-stone-900"
        >
          {tiers.filter(t => t <= (settings?.currentTier ?? 100)).map(t => (
            <option key={t} value={t}>Tier ≤{t}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-1 rounded ${filter === f ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900' : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as Sort)}
          className="text-sm border border-stone-300 dark:border-stone-700 rounded-lg px-2 py-1 bg-white dark:bg-stone-900"
        >
          <option value="frequency">Frequency</option>
          <option value="alpha">Alphabetical</option>
          <option value="hardest">Hardest</option>
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-sm border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-1 bg-white dark:bg-stone-900 flex-1 min-w-[120px]"
        />

        <span className="text-xs text-stone-400">{filtered.length} words</span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const startIdx = virtualRow.index * COLS;
            const rowItems = filtered.slice(startIdx, startIdx + COLS);

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="grid grid-cols-4 gap-2"
              >
                {rowItems.map(w => (
                  <Link
                    key={w.id}
                    to={`/word/${w.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    <div className="w-12 h-12 rounded bg-stone-100 dark:bg-stone-800 shrink-0 overflow-hidden flex items-center justify-center">
                      {w.imageFile ? (
                        <img src={assetUrl(w.imageFile!)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-light text-stone-400">{w.pt.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{w.pt}</p>
                      <p className="text-xs text-stone-500 truncate">{w.pl}</p>
                      <span className={`text-[10px] px-1 rounded ${
                        w.cardState === 'New' ? 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300' :
                        w.cardState === 'Learning' ? 'bg-amber-100 text-amber-700' :
                        w.cardState === 'Review' ? 'bg-green-100 text-green-700' :
                        w.cardState === 'Mastered' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {w.cardState}{w.daysTillDue ? ` (${w.daysTillDue}d)` : ''}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
