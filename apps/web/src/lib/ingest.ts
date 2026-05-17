import { db } from './db';
import { makeNewCard } from './fsrs';
import type { Card, WordEntry } from './types';

type Tier = 10 | 100 | 300 | 500 | 1000 | 3000 | 10000;

const tierModules: Record<number, () => Promise<{ default: unknown }>> = {
  10: () => import('../data/tier-10.json'),
  100: () => import('../data/tier-100.json'),
};

async function loadTierModule(tier: Tier): Promise<WordEntry[] | null> {
  try {
    const loader = tierModules[tier];
    if (!loader) {
      const mod = await import(`../data/tier-${tier}.json`);
      return mod.default as WordEntry[];
    }
    const mod = await loader();
    return mod.default as WordEntry[];
  } catch {
    return null;
  }
}

function createInitialCard(wordId: string, direction: 'pt_to_pl' | 'pl_to_pt'): Card {
  const now = new Date();
  const state = makeNewCard(now);
  return {
    id: `${wordId}:${direction}`,
    wordId,
    direction,
    ...state,
    suspended: false,
  };
}

export async function loadTierIntoDb(tier: Tier): Promise<number> {
  const words = await loadTierModule(tier);
  if (!words) return 0;

  let added = 0;
  await db.transaction('rw', db.words, db.cards, async () => {
    for (const w of words) {
      const existing = await db.words.get(w.id);
      if (existing) continue;
      await db.words.add(w);
      await db.cards.bulkAdd([
        createInitialCard(w.id, 'pt_to_pl'),
        createInitialCard(w.id, 'pl_to_pt'),
      ]);
      added++;
    }
  });
  return added;
}

export async function isTierAvailable(tier: Tier): Promise<boolean> {
  const words = await loadTierModule(tier);
  return words !== null && words.length > 0;
}

export async function getTierWordCount(tier: Tier): Promise<number> {
  const words = await loadTierModule(tier);
  return words?.length ?? 0;
}
