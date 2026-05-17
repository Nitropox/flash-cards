import { FSRS, generatorParameters, createEmptyCard, State, type Card as FSRSCard, type Grade } from 'ts-fsrs';
import type { Card, CardState } from './types';

const params = generatorParameters({
  request_retention: 0.90,
  maximum_interval: 36500,
});

export const fsrs = new FSRS(params);

function stateToString(state: State): CardState {
  switch (state) {
    case State.New: return "New";
    case State.Learning: return "Learning";
    case State.Review: return "Review";
    case State.Relearning: return "Relearning";
  }
}

function stringToState(state: CardState): State {
  switch (state) {
    case "New": return State.New;
    case "Learning": return State.Learning;
    case "Review": return State.Review;
    case "Relearning": return State.Relearning;
  }
}

export function makeNewCard(now?: Date): Pick<Card, 'due' | 'stability' | 'difficulty' | 'elapsedDays' | 'scheduledDays' | 'reps' | 'lapses' | 'state'> {
  const empty = createEmptyCard(now);
  return {
    due: empty.due,
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsedDays: empty.elapsed_days,
    scheduledDays: empty.scheduled_days,
    reps: empty.reps,
    lapses: empty.lapses,
    state: stateToString(empty.state),
  };
}

function cardToFSRS(card: Card): FSRSCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: 0,
    reps: card.reps,
    lapses: card.lapses,
    state: stringToState(card.state),
    last_review: card.lastReview,
  };
}

export function applyReview(card: Card, rating: 1 | 2 | 3 | 4, now: Date): { updatedCard: Card; log: { cardId: string; rating: 1 | 2 | 3 | 4; reviewedAt: Date; elapsedDaysAtReview: number } } {
  const fsrsCard = cardToFSRS(card);
  const grade = rating as unknown as Grade;
  const result = fsrs.next(fsrsCard, now, grade);

  const updatedCard: Card = {
    ...card,
    due: result.card.due,
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    elapsedDays: result.card.elapsed_days,
    scheduledDays: result.card.scheduled_days,
    reps: result.card.reps,
    lapses: result.card.lapses,
    state: stateToString(result.card.state),
    lastReview: now,
    introducedAt: card.introducedAt ?? now,
    masteredAt: result.card.stability > 90 && !card.masteredAt ? now : card.masteredAt,
  };

  return {
    updatedCard,
    log: {
      cardId: card.id,
      rating,
      reviewedAt: now,
      elapsedDaysAtReview: card.elapsedDays,
    },
  };
}
