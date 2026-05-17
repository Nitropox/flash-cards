import { db } from './db';
import { makeNewCard } from './fsrs';
import type { Card, WordEntry, Settings } from './types';
import tier10Data from '../data/tier-10.json';
import tier100Data from '../data/tier-100.json';

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

async function ingestWords(words: WordEntry[]) {
  const now = new Date();
  const newCardState = makeNewCard(now);
  const cards: Card[] = [];

  for (const word of words) {
    const existing = await db.words.get(word.id);
    if (existing) continue;

    await db.words.add(word);
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

  if (cards.length > 0) {
    await db.cards.bulkAdd(cards);
  }
}

export async function seedIfEmpty() {
  const count = await db.words.count();
  if (count > 0) return;

  await db.transaction('rw', db.words, db.cards, db.settings, async () => {
    await ingestWords(tier10Data as WordEntry[]);
    await ingestWords(tier100Data as WordEntry[]);
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
