import { db } from './db';
import { makeNewCard } from './fsrs';
import type { Card, WordEntry, Settings } from './types';
import tierData from '../data/tier-10.json';

const DEFAULT_SETTINGS: Settings = {
  key: 'current',
  currentTier: 10,
  newCardsPerDay: 10,
  maxReviewsPerSession: 30,
  targetRetention: 0.90,
  defaultAnswerMode: 'self_rate',
  ttsVoice: 'Raquel',
  ttsAutoPlay: true,
  showPhonetics: false,
  theme: 'system',
};

export async function seedIfEmpty() {
  const count = await db.words.count();
  if (count > 0) return;

  const words = tierData as WordEntry[];
  const now = new Date();
  const newCardState = makeNewCard(now);

  const cards: Card[] = [];
  for (const word of words) {
    cards.push({
      id: `${word.id}:pt_to_pl`,
      wordId: word.id,
      direction: 'pt_to_pl',
      ...newCardState,
      suspended: false,
    });
    cards.push({
      id: `${word.id}:pl_to_pt`,
      wordId: word.id,
      direction: 'pl_to_pt',
      ...newCardState,
      suspended: false,
    });
  }

  await db.transaction('rw', db.words, db.cards, db.settings, async () => {
    await db.words.bulkAdd(words);
    await db.cards.bulkAdd(cards);
    const existing = await db.settings.get('current');
    if (!existing) {
      await db.settings.add(DEFAULT_SETTINGS);
    }
  });
}

export async function resetProgress() {
  await db.transaction('rw', db.words, db.cards, db.reviewLog, db.settings, async () => {
    await db.cards.clear();
    await db.reviewLog.clear();
    await db.words.clear();
  });
  await seedIfEmpty();
}
