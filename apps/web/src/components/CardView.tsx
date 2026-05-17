import { useEffect, useState, useCallback, useRef } from 'react';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    db.words.get(card.wordId).then(w => setWord(w ?? null));
  }, [card.wordId]);

  const playAudio = useCallback((path: string | undefined) => {
    if (!path) return;
    const audio = new Audio(`/${path}`);
    audio.play().catch(() => {});
    audioRef.current = audio;
  }, []);

  useEffect(() => {
    if (isRevealed && word) {
      playAudio(word.audioPt);
    }
  }, [isRevealed, word, playAudio]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!isRevealed || !word) return;
      if (e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        playAudio(word.audioPt);
      } else if (e.key === 'P' && e.shiftKey) {
        e.preventDefault();
        playAudio(word.audioExamplePt);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isRevealed, word, playAudio]);

  if (!word) return null;

  const promptWord = card.direction === 'pt_to_pl' ? word.pt : word.pl;
  const answerWord = card.direction === 'pt_to_pl' ? word.pl : word.pt;
  const directionLabel = card.direction === 'pt_to_pl' ? 'PT → PL' : 'PL → PT';

  const renderImage = () => {
    if (word.imageStrategy === 'none') {
      return (
        <div className="w-60 h-60 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-6">
          <span className="text-5xl font-semibold text-stone-600 dark:text-stone-300 text-center px-4 leading-tight">
            {word.pt}
          </span>
        </div>
      );
    }

    if (word.imageFile) {
      return (
        <div className="w-60 h-60 rounded-xl overflow-hidden mb-6 bg-stone-100 dark:bg-stone-800">
          <img
            src={`/${word.imageFile}`}
            alt=""
            width={240}
            height={240}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-6xl font-light text-stone-400 dark:text-stone-600 flex items-center justify-center w-full h-full">${word.pt.charAt(0).toUpperCase()}</span>`;
            }}
          />
        </div>
      );
    }

    return (
      <div className="w-60 h-60 rounded-xl bg-stone-200 dark:bg-stone-800 flex items-center justify-center mb-6">
        <span className="text-6xl font-light text-stone-400 dark:text-stone-600 select-none">
          {word.pt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center">
      {renderImage()}

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
            <div className="flex items-center justify-center gap-2">
              <p className="text-2xl text-sky-600 dark:text-sky-400">{word.pt}</p>
              <button
                onClick={() => playAudio(word.audioPt)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-lg"
                title="Play word (P)"
              >
                🔊
              </button>
            </div>
            <p className="text-2xl text-red-600 dark:text-red-400">{answerWord}</p>
          </div>

          <div className="bg-stone-100 dark:bg-stone-800 rounded-lg p-4 mb-2 text-left">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-sm text-stone-600 dark:text-stone-300">{word.examplePt}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{word.examplePl}</p>
              </div>
              <button
                onClick={() => playAudio(word.audioExamplePt)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-sm shrink-0"
                title="Play example (Shift+P)"
              >
                🔊
              </button>
            </div>
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
