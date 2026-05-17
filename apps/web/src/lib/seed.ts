import { db } from './db';
import type { Settings } from './types';
import { loadTierIntoDb } from './ingest';

const DEFAULT_SETTINGS: Settings = {
  key: 'current',
  currentTier: 100,
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

  const existing = await db.settings.get('current');
  if (!existing) {
    await db.settings.add(DEFAULT_SETTINGS);
  }

  await loadTierIntoDb(10);
  await loadTierIntoDb(100);
}

export async function resetProgress() {
  await db.transaction('rw', db.words, db.cards, db.reviewLog, db.settings, async () => {
    await db.cards.clear();
    await db.reviewLog.clear();
    await db.words.clear();
  });
  await seedIfEmpty();
}
