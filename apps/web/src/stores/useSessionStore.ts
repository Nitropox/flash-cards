import { create } from 'zustand';
import type { Card } from '../lib/types';

type SessionState = {
  queue: Card[];
  cursor: number;
  isRevealed: boolean;
  isComplete: boolean;
  setQueue: (cards: Card[]) => void;
  reveal: () => void;
  advance: () => void;
  reset: () => void;
  currentCard: () => Card | undefined;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  queue: [],
  cursor: 0,
  isRevealed: false,
  isComplete: false,

  setQueue: (cards) => set({ queue: cards, cursor: 0, isRevealed: false, isComplete: false }),

  reveal: () => set((s) => ({ isRevealed: !s.isRevealed })),

  advance: () => {
    const { cursor, queue } = get();
    const next = cursor + 1;
    if (next >= queue.length) {
      set({ isComplete: true });
    } else {
      set({ cursor: next, isRevealed: false });
    }
  },

  reset: () => set({ queue: [], cursor: 0, isRevealed: false, isComplete: false }),

  currentCard: () => {
    const { queue, cursor } = get();
    return queue[cursor];
  },
}));
