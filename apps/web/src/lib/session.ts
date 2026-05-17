import { db } from './db';
import type { Card, Settings } from './types';

function getToday(): Date {
  const now = new Date();
  const shifted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  shifted.setHours(0, 0, 0, 0);
  return shifted;
}

async function countNewCardsIntroducedToday(): Promise<number> {
  const today = getToday();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const logs = await db.reviewLog
    .where('reviewedAt')
    .between(today, tomorrow, true, false)
    .toArray();

  const cardIds = new Set(logs.map(l => l.cardId));
  let count = 0;
  for (const cardId of cardIds) {
    const card = await db.cards.get(cardId);
    if (card && card.reps === 1 && card.introducedAt) {
      const introDay = new Date(card.introducedAt.getTime() - 4 * 60 * 60 * 1000);
      introDay.setHours(0, 0, 0, 0);
      if (introDay.getTime() === today.getTime()) {
        count++;
      }
    }
  }
  return count;
}

export async function buildSessionQueue(): Promise<Card[]> {
  const settings = await db.settings.get('current') as Settings | undefined;
  if (!settings) return [];

  const now = new Date();
  const maxReviews = settings.maxReviewsPerSession;

  const learningCards = await db.cards
    .where('[state+due]')
    .between(['Learning', new Date(0)], ['Learning', now], true, true)
    .filter(c => !c.suspended)
    .toArray();

  const relearningCards = await db.cards
    .where('[state+due]')
    .between(['Relearning', new Date(0)], ['Relearning', now], true, true)
    .filter(c => !c.suspended)
    .toArray();

  const reviewCards = await db.cards
    .where('[state+due]')
    .between(['Review', new Date(0)], ['Review', now], true, true)
    .filter(c => !c.suspended)
    .toArray();

  const allDue = [...learningCards, ...relearningCards, ...reviewCards];

  // Prevent both directions of the same word in a single session
  const seenWordIds = new Set<string>();
  const queue: Card[] = [];
  for (const card of allDue) {
    if (seenWordIds.has(card.wordId)) continue;
    seenWordIds.add(card.wordId);
    queue.push(card);
  }

  if (queue.length < maxReviews) {
    const newCardsToday = await countNewCardsIntroducedToday();
    const remaining = settings.newCardsPerDay - newCardsToday;

    if (remaining > 0) {
      const slotsAvailable = Math.min(remaining, maxReviews - queue.length);
      const newCards = await db.cards
        .where('state')
        .equals('New')
        .filter(c => !c.suspended)
        .toArray();

      const wordIds = [...new Set(newCards.map(c => c.wordId))];
      const words = await db.words.bulkGet(wordIds);
      const wordRankMap = new Map<string, number>();
      for (const w of words) {
        if (w && w.tier <= settings.currentTier) {
          wordRankMap.set(w.id, w.frequencyRank);
        }
      }

      const eligible = newCards
        .filter(c => wordRankMap.has(c.wordId))
        .filter(c => !seenWordIds.has(c.wordId))
        .sort((a, b) => {
          const rankA = wordRankMap.get(a.wordId) ?? Infinity;
          const rankB = wordRankMap.get(b.wordId) ?? Infinity;
          if (rankA !== rankB) return rankA - rankB;
          return a.direction === 'pt_to_pl' ? -1 : 1;
        });

      const selected: Card[] = [];

      for (const card of eligible) {
        if (selected.length >= slotsAvailable) break;

        if (seenWordIds.has(card.wordId)) continue;

        if (card.direction === 'pl_to_pt') {
          const existingPt = await db.cards.get(`${card.wordId}:pt_to_pl`);
          if (existingPt && existingPt.state === 'New') {
            continue;
          }
        }

        seenWordIds.add(card.wordId);
        selected.push(card);
      }

      queue.push(...selected);
    }
  }

  return queue.slice(0, maxReviews);
}

export async function getDueCount(): Promise<{ due: number; newAvailable: number }> {
  const now = new Date();
  const settings = await db.settings.get('current') as Settings | undefined;
  if (!settings) return { due: 0, newAvailable: 0 };

  const learningDue = await db.cards
    .where('[state+due]')
    .between(['Learning', new Date(0)], ['Learning', now], true, true)
    .filter(c => !c.suspended)
    .count();

  const relearningDue = await db.cards
    .where('[state+due]')
    .between(['Relearning', new Date(0)], ['Relearning', now], true, true)
    .filter(c => !c.suspended)
    .count();

  const reviewDue = await db.cards
    .where('[state+due]')
    .between(['Review', new Date(0)], ['Review', now], true, true)
    .filter(c => !c.suspended)
    .count();

  const newCardsToday = await countNewCardsIntroducedToday();
  const newRemaining = Math.max(0, settings.newCardsPerDay - newCardsToday);

  const totalNew = await db.cards
    .where('state')
    .equals('New')
    .filter(c => !c.suspended)
    .count();

  return {
    due: learningDue + relearningDue + reviewDue,
    newAvailable: Math.min(newRemaining, totalNew),
  };
}

export async function getStreak(): Promise<number> {
  const logs = await db.reviewLog.orderBy('reviewedAt').reverse().toArray();
  if (logs.length === 0) return 0;

  const reviewDays = new Set<string>();
  for (const log of logs) {
    const shifted = new Date(log.reviewedAt.getTime() - 4 * 60 * 60 * 1000);
    const dayStr = shifted.toISOString().slice(0, 10);
    reviewDays.add(dayStr);
  }

  const sortedDays = [...reviewDays].sort().reverse();
  const today = new Date();
  const shiftedToday = new Date(today.getTime() - 4 * 60 * 60 * 1000);
  const todayStr = shiftedToday.toISOString().slice(0, 10);

  if (sortedDays[0] !== todayStr) {
    const yesterday = new Date(shiftedToday.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (sortedDays[0] !== yesterdayStr) return 0;
  }

  let streak = 0;
  let checkDate = new Date(sortedDays[0]!);

  for (const day of sortedDays) {
    const expected = checkDate.toISOString().slice(0, 10);
    if (day === expected) {
      streak++;
      checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
    } else if (day < expected) {
      break;
    }
  }

  return streak;
}
