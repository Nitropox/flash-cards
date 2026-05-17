import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/db';
import { makeNewCard } from '../lib/fsrs';
import { assetUrl } from '../lib/assets';
import type { Card, WordEntry } from '../lib/types';

export function WordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [word, setWord] = useState<WordEntry | null>(null);
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const w = await db.words.get(id!);
      if (w) setWord(w);
      const ptCard = await db.cards.get(`${id}:pt_to_pl`);
      const plCard = await db.cards.get(`${id}:pl_to_pt`);
      setCards([ptCard, plCard].filter(Boolean) as Card[]);
    }
    load();
  }, [id]);

  if (!word) return <div className="text-stone-400 mt-20 text-center">Loading...</div>;

  async function handleSuspend() {
    if (!confirm('Suspend both directions of this word?')) return;
    for (const c of cards) {
      await db.cards.update(c.id, { suspended: true });
    }
    const updated = await Promise.all(cards.map(c => db.cards.get(c.id)));
    setCards(updated.filter(Boolean) as Card[]);
  }

  async function handleReset() {
    if (!confirm('Reset both cards to New? This erases all review history for this word.')) return;
    const now = new Date();
    const state = makeNewCard(now);
    for (const c of cards) {
      await db.cards.update(c.id, { ...state, suspended: false, introducedAt: undefined, masteredAt: undefined });
    }
    const updated = await Promise.all(cards.map(c => db.cards.get(c.id)));
    setCards(updated.filter(Boolean) as Card[]);
  }

  function formatDue(card: Card): string {
    const now = new Date();
    const diff = card.due.getTime() - now.getTime();
    if (diff <= 0) return 'due now';
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `due in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `due in ${days}d`;
  }

  const posLabel: Record<string, string> = {
    noun: 'rzeczownik', verb: 'czasownik', adj: 'przymiotnik', adv: 'przysłówek',
    pron: 'zaimek', prep: 'przyimek', conj: 'spójnik', det: 'rodzajnik',
    interj: 'wykrzyknik', phrase: 'fraza', num: 'liczebnik',
  };

  return (
    <div className="max-w-xl mx-auto">
      <Link to="/browse" className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
        &larr; Back to browse
      </Link>

      <div className="mt-6 flex flex-col items-center">
        <div className="w-80 h-80 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 mb-4">
          {word.imageFile ? (
            <img src={assetUrl(word.imageFile!)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl font-light text-stone-400">{word.pt.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>

        <h1 className="text-3xl font-bold">{word.pt}</h1>
        <p className="text-sm text-stone-500 mt-1">
          {posLabel[word.partOfSpeech] || word.partOfSpeech}
          {word.gender && `, ${word.gender === 'f' ? 'żeński' : 'męski'}`}
        </p>
        <p className="text-2xl text-blue-600 dark:text-blue-400 mt-2">{word.pl}</p>
      </div>

      <div className="mt-6 bg-stone-100 dark:bg-stone-800 rounded-lg p-4">
        <p className="text-lg text-stone-700 dark:text-stone-200">{word.examplePt}</p>
        <p className="text-lg text-stone-500 dark:text-stone-400 mt-2">{word.examplePl}</p>
      </div>

      {word.notes && (
        <p className="text-sm text-stone-500 italic mt-3">{word.notes}</p>
      )}

      <div className="mt-8 border-t border-stone-200 dark:border-stone-800 pt-4">
        <h3 className="text-sm font-medium text-stone-500 mb-3">Review status</h3>
        {cards.map(c => (
          <div key={c.id} className="flex justify-between items-center py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
            <span className="text-sm">
              {c.direction === 'pt_to_pl' ? 'PT → PL' : 'PL → PT'}
            </span>
            <div className="text-right text-sm">
              <span className={`px-2 py-0.5 rounded text-xs ${
                c.suspended ? 'bg-red-100 text-red-700' :
                c.state === 'New' ? 'bg-stone-200 text-stone-600' :
                c.state === 'Learning' ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {c.suspended ? 'Suspended' : c.state}
              </span>
              {!c.suspended && c.state !== 'New' && (
                <span className="text-xs text-stone-400 ml-2">
                  {formatDue(c)} · stability: {c.stability.toFixed(1)}d
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSuspend}
          className="px-4 py-2 text-sm bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg hover:opacity-80"
        >
          Suspend both
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:opacity-80"
        >
          Reset both
        </button>
      </div>
    </div>
  );
}
