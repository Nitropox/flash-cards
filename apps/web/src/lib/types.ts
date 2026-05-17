export type WordEntry = {
  id: string;
  type: "word" | "phrase";
  pt: string;
  pl: string;
  partOfSpeech: "noun" | "verb" | "adj" | "adv" | "pron" | "prep" | "conj" | "det" | "interj" | "phrase" | "num";
  gender?: "m" | "f" | "mf";
  pluralPt?: string;
  conjugationHint?: string;
  examplePt: string;
  examplePl: string;
  frequencyRank: number;
  tier: 10 | 100 | 300 | 500 | 1000 | 3000 | 10000;
  imageStrategy: "literal" | "scene" | "none";
  imagePrompt?: string;
  imageFile?: string;
  audioPt: string;
  audioExamplePt: string;
  notes?: string;
};

export type Direction = "pt_to_pl" | "pl_to_pt";

export type CardState = "New" | "Learning" | "Review" | "Relearning";

export type Card = {
  id: string;
  wordId: string;
  direction: Direction;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview?: Date;
  suspended: boolean;
  introducedAt?: Date;
  masteredAt?: Date;
};

export type ReviewLog = {
  id?: number;
  cardId: string;
  rating: 1 | 2 | 3 | 4;
  reviewedAt: Date;
  elapsedDaysAtReview: number;
  answerMode: "self_rate" | "typed" | "spoken";
  userAnswer?: string;
  durationMs: number;
};

export type Settings = {
  key: string;
  currentTier: 10 | 100 | 300 | 500 | 1000 | 3000 | 10000;
  newCardsPerDay: number;
  maxReviewsPerSession: number;
  targetRetention: number;
  defaultAnswerMode: "self_rate" | "typed" | "spoken";
  ttsVoice: "Raquel" | "Duarte";
  ttsAutoPlay: boolean;
  showPhonetics: boolean;
  theme: "light" | "dark" | "system";
};
