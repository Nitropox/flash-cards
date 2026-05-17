import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { loadTierIntoDb } from '../lib/ingest';
import type { Settings } from '../lib/types';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [pace, setPace] = useState(10);

  async function finish() {
    const settings: Settings = {
      key: 'current',
      currentTier: 100,
      newCardsPerDay: pace,
      maxReviewsPerSession: 30,
      targetRetention: 0.90,
      defaultAnswerMode: 'self_rate',
      ttsVoice: 'Raquel',
      ttsAutoPlay: true,
      showPhonetics: false,
      theme: 'system',
    };
    await db.settings.put(settings);
    await loadTierIntoDb(10);
    await loadTierIntoDb(100);
    navigate('/learn');
  }

  if (step === 0) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <h1 className="text-3xl font-bold">pt-cards</h1>
        <p className="text-lg text-stone-600 dark:text-stone-300">
          Learn European Portuguese through image-anchored flashcards with spaced repetition.
        </p>
        <p className="text-stone-500 dark:text-stone-400">
          You'll start with 10 essential words today. The app will introduce more words gradually as your memory strengthens.
        </p>
        <button
          onClick={() => setStep(1)}
          className="px-8 py-3 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 rounded-lg font-medium"
        >
          Continue
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <h2 className="text-2xl font-bold">How many new words per day?</h2>
        <div className="space-y-3 text-left max-w-xs mx-auto">
          {[
            { value: 5, label: 'Light (5 new)', desc: '~10 min/day' },
            { value: 10, label: 'Standard (10 new)', desc: '~20 min/day' },
            { value: 20, label: 'Intense (20 new)', desc: '~40 min/day' },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
              <input
                type="radio"
                name="pace"
                checked={pace === opt.value}
                onChange={() => setPace(opt.value)}
                className="accent-stone-800"
              />
              <div>
                <span className="font-medium">{opt.label}</span>
                <span className="text-sm text-stone-500 ml-2">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>
        <button
          onClick={finish}
          className="px-8 py-3 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 rounded-lg font-medium"
        >
          Start learning
        </button>
      </div>
    );
  }

  return null;
}
