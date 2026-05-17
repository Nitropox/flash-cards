import { useState } from 'react';

type Props = {
  tier: number;
  wordCount: number;
  onDismiss: () => void;
  onPause: () => void;
};

export function UnlockToast({ tier, wordCount, onDismiss, onPause }: Props) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg p-5 max-w-md z-50">
      <p className="text-lg font-semibold mb-1">Tier {tier} unlocked</p>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        Dodano {wordCount} nowych slow do puli.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => { setVisible(false); onDismiss(); }}
          className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 rounded-lg font-medium"
        >
          Got it
        </button>
        <button
          onClick={() => { setVisible(false); onPause(); }}
          className="px-4 py-2 text-sm bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg"
        >
          Pause tier {tier}
        </button>
      </div>
    </div>
  );
}
