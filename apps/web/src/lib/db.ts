import Dexie, { type Table } from 'dexie';
import type { WordEntry, Card, ReviewLog, Settings } from './types';

class PtCardsDB extends Dexie {
  words!: Table<WordEntry, string>;
  cards!: Table<Card, string>;
  reviewLog!: Table<ReviewLog, number>;
  settings!: Table<Settings, string>;

  constructor() {
    super('pt-cards');
    this.version(1).stores({
      words: 'id, frequencyRank, tier, type',
      cards: 'id, wordId, due, state, suspended, [state+due]',
      reviewLog: '++id, cardId, reviewedAt',
      settings: 'key',
    });
  }
}

export const db = new PtCardsDB();
