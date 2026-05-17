import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import type { Card, WordEntry } from '../lib/types';
import { RatingButtons } from './RatingButtons';

type Props = {
  card: Card;
  isRevealed: boolean;
  onReveal: () => void;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
};

export function CardView({ card, isRevealed, onReveal, onRate }: Props) {
  const [word, setWord] = useState<WordEntry | null>(null);

  useEffect(() => {
    db.words.get(card.wordId).then(w => setWord(w ?? null));
  }, [card.wordId]);

  if (!word) return null;

  const promptWord = card.direction === 'pt_to_pl' ? word.pt : word.pl;
  const answerWord = card.direction === 'pt_to_pl' ? word.pl : word.pt;
  const directionLabel = card.direction === 'pt_to_pl' ? 'PT → PL' : 'PL → PT';

  return (
    <div className="flex flex-col items-center">
      <div className="w-60 h-60 rounded-xl bg-stone-200 dark:bg-stone-800 flex items-center justify-center mb-6">
        <span className="text-6xl font-light text-stone-400 dark:text-stone-600 select-none">
          {word.pt.charAt(0).toUpperCase()}
        </span>
      </div>

      <span className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-2">
        {directionLabel}
      </span>

      <h2 className="text-3xl font-semibold mb-2">{promptWord}</h2>

      {!isRevealed ? (
        <button
          onClick={onReveal}
          className="mt-8 px-8 py-3 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Reveal <span className="opacity-60 ml-1">Space</span>
        </button>
      ) : (
        <div className="mt-4 w-full text-center">
          <div className="space-y-2 mb-4">
            <p className="text-2xl text-sky-600 dark:text-sky-400">{word.pt}</p>
            <p className="text-2xl text-red-600 dark:text-red-400">{answerWord}</p>
          </div>

          <div className="bg-stone-100 dark:bg-stone-800 rounded-lg p-4 mb-2 text-left">
            <p className="text-sm text-stone-600 dark:text-stone-300">{word.examplePt}</p>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{word.examplePl}</p>
          </div>

          {word.notes && (
            <p className="text-xs text-stone-400 dark:text-stone-500 italic mt-2 mb-2">{word.notes}</p>
          )}

          <RatingButtons onRate={onRate} />
        </div>
      )}
    </div>
  );
}
