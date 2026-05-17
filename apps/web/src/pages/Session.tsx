import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/useSessionStore';
import { buildSessionQueue } from '../lib/session';
import { applyReview } from '../lib/fsrs';
import { db } from '../lib/db';
import { CardView } from '../components/CardView';
import { UnlockToast } from '../components/Toast';
import { checkAndAutoUnlock, pauseTier, type UnlockResult } from '../lib/tierUnlock';

export function Session() {
  const navigate = useNavigate();
  const { queue, cursor, isRevealed, isComplete, setQueue, reveal, advance, reset } = useSessionStore();
  const card = queue[cursor];
  const [unlockResult, setUnlockResult] = useState<UnlockResult | null>(null);

  useEffect(() => {
    buildSessionQueue().then((cards) => {
      if (cards.length === 0) {
        navigate('/');
      } else {
        setQueue(cards);
      }
    });
    return () => reset();
  }, [setQueue, reset, navigate]);

  useEffect(() => {
    if (isComplete) {
      checkAndAutoUnlock().then(setUnlockResult);
    }
  }, [isComplete]);

  const handleRate = useCallback(async (rating: 1 | 2 | 3 | 4, mode: 'self_rate' | 'typed' | 'spoken', userAnswer?: string) => {
    if (!card) return;
    const now = new Date();
    const startTime = performance.now();
    const { updatedCard, log } = applyReview(card, rating, now);

    await db.cards.put(updatedCard);
    await db.reviewLog.add({
      cardId: log.cardId,
      rating: log.rating,
      reviewedAt: log.reviewedAt,
      elapsedDaysAtReview: log.elapsedDaysAtReview,
      answerMode: mode,
      userAnswer,
      durationMs: Math.round(performance.now() - startTime),
    });

    advance();
  }, [card, advance]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (confirm('Exit session?')) {
        reset();
        navigate('/');
      }
      return;
    }

    if (!card) return;

    if (e.key === ' ') {
      const active = document.activeElement;
      if (active && active.tagName === 'INPUT') return;
      e.preventDefault();
      reveal();
      return;
    }

    if (isRevealed) {
      const rating = { '1': 1, '2': 2, '3': 3, '4': 4 }[e.key] as 1 | 2 | 3 | 4 | undefined;
      if (rating) {
        handleRate(rating, 'self_rate');
      }
    }
  }, [card, isRevealed, reveal, handleRate, reset, navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isComplete) {
    return (
      <div className="flex flex-col items-center gap-6 mt-12">
        <h2 className="text-2xl font-semibold">All caught up!</h2>
        <p className="text-stone-500 dark:text-stone-400">See you tomorrow.</p>
        <button
          onClick={() => { reset(); navigate('/'); }}
          className="px-6 py-3 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Back to dashboard
        </button>

        {unlockResult?.action === 'unlocked' && (
          <UnlockToast
            tier={unlockResult.tier}
            wordCount={unlockResult.wordCount}
            onDismiss={() => setUnlockResult(null)}
            onPause={() => { pauseTier(unlockResult.tier); setUnlockResult(null); }}
          />
        )}

        {unlockResult?.action === 'content_missing' && (
          <p className="text-sm text-stone-400 mt-4">
            You've mastered tier {unlockResult.currentTier}! Higher tiers require content generation.
          </p>
        )}
      </div>
    );
  }

  if (!card) {
    return <div className="text-center text-stone-400 mt-20">Loading session...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => { if (confirm('Exit session?')) { reset(); navigate('/'); } }}
          className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
        >
          &larr; Exit
        </button>
        <span className="text-sm text-stone-400">
          {cursor + 1} / {queue.length}
        </span>
      </div>
      <CardView
        card={card}
        isRevealed={isRevealed}
        onReveal={reveal}
        onRate={handleRate}
      />
    </div>
  );
}
