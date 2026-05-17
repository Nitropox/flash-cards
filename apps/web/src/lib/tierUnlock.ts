import { db } from './db';
import { loadTierIntoDb, isTierAvailable } from './ingest';
import type { Settings } from './types';

type Tier = 10 | 100 | 300 | 500 | 1000 | 3000 | 10000;
const TIER_ORDER: Tier[] = [10, 100, 300, 500, 1000, 3000, 10000];

function nextTier(current: Tier): Tier | null {
  const idx = TIER_ORDER.indexOf(current);
  return TIER_ORDER[idx + 1] ?? null;
}

export type UnlockResult =
  | { action: 'none' }
  | { action: 'unlocked'; tier: number; wordCount: number }
  | { action: 'ready'; tier: number }
  | { action: 'content_missing'; currentTier: number };

export async function checkAndAutoUnlock(): Promise<UnlockResult> {
  const settings = await db.settings.get('current') as Settings | undefined;
  if (!settings) return { action: 'none' };

  const next = nextTier(settings.currentTier);
  if (!next) return { action: 'none' };

  const tierWords = await db.words.where('tier').belowOrEqual(settings.currentTier).toArray();
  const tierWordIds = new Set(tierWords.map(w => w.id));

  const tierCards = (await db.cards.toArray())
    .filter(c => tierWordIds.has(c.wordId) && c.direction === 'pt_to_pl' && !c.suspended);

  if (tierCards.length === 0) return { action: 'none' };

  const reviewCards = tierCards.filter(c => c.state === 'Review' || c.stability > 90);
  const pct = reviewCards.length / tierCards.length;
  const avgStability = reviewCards.length > 0
    ? reviewCards.reduce((sum, c) => sum + c.stability, 0) / reviewCards.length
    : 0;

  if (pct < 0.8 || avgStability < 21) return { action: 'none' };

  if (settings.lastUnlockToastShownFor === next) return { action: 'none' };

  const available = await isTierAvailable(next);
  if (!available) {
    return { action: 'content_missing', currentTier: settings.currentTier };
  }

  if (!settings.autoUnlockTiers) {
    return { action: 'ready', tier: next };
  }

  const wordCount = await loadTierIntoDb(next);

  if (settings.pausedTiers.includes(next)) {
    const newCards = await db.cards
      .filter(c => {
        const word = tierWords.find(w => w.id === c.wordId);
        return !word && c.state === 'New';
      })
      .toArray();
    for (const card of newCards) {
      await db.cards.update(card.id, { suspended: true });
    }
  }

  await db.settings.update('current', {
    currentTier: next,
    lastUnlockToastShownFor: next,
  });

  return { action: 'unlocked', tier: next, wordCount };
}

export async function pauseTier(tier: number) {
  const settings = await db.settings.get('current') as Settings | undefined;
  if (!settings) return;

  const paused = [...settings.pausedTiers];
  if (!paused.includes(tier)) paused.push(tier);
  await db.settings.update('current', { pausedTiers: paused });

  const words = await db.words.where('tier').equals(tier).toArray();
  const wordIds = new Set(words.map(w => w.id));
  const cards = await db.cards.filter(c => wordIds.has(c.wordId) && c.state === 'New').toArray();
  for (const card of cards) {
    await db.cards.update(card.id, { suspended: true });
  }
}

export async function resumeTier(tier: number) {
  const settings = await db.settings.get('current') as Settings | undefined;
  if (!settings) return;

  const paused = settings.pausedTiers.filter(t => t !== tier);
  await db.settings.update('current', { pausedTiers: paused });

  const words = await db.words.where('tier').equals(tier).toArray();
  const wordIds = new Set(words.map(w => w.id));
  const cards = await db.cards.filter(c => wordIds.has(c.wordId) && c.suspended).toArray();
  for (const card of cards) {
    await db.cards.update(card.id, { suspended: false });
  }
}
