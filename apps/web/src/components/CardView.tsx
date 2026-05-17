import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../lib/db';
import type { Card, WordEntry } from '../lib/types';
import { gradeMultiple, type GradeResult } from '../lib/grading';
import { isSttAvailable, recognizePortuguese } from '../lib/speech';
import { RatingButtons } from './RatingButtons';

type AnswerMode = 'self_rate' | 'typed' | 'spoken';

type Props = {
  card: Card;
  isRevealed: boolean;
  onReveal: () => void;
  onRate: (rating: 1 | 2 | 3 | 4, mode: AnswerMode, userAnswer?: string) => void;
};

export function CardView({ card, isRevealed, onReveal, onRate }: Props) {
  const [word, setWord] = useState<WordEntry | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [mode, setMode] = useState<AnswerMode>('self_rate');
  const [typedInput, setTypedInput] = useState('');
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [overrideRating, setOverrideRating] = useState<1 | 2 | 3 | 4 | null>(null);
  const [listening, setListening] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.words.get(card.wordId).then(w => setWord(w ?? null));
    setShowExample(false);
    setTypedInput('');
    setGradeResult(null);
    setOverrideRating(null);
    setListening(false);
  }, [card.wordId, card.direction]);

  useEffect(() => {
    db.settings.get('current').then(s => {
      if (s && 'defaultAnswerMode' in s) {
        setMode(s.defaultAnswerMode as AnswerMode);
      }
    });
  }, []);

  const playAudio = useCallback((path: string | undefined) => {
    if (!path) return;
    const audio = new Audio(`/${path}`);
    audio.play().catch(() => {});
    audioRef.current = audio;
  }, []);

  useEffect(() => {
    if (isRevealed && word && mode === 'self_rate') {
      playAudio(word.audioPt);
    }
  }, [isRevealed, word, playAudio, mode]);

  useEffect(() => {
    if (mode === 'typed' && !isRevealed && !gradeResult) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [mode, isRevealed, gradeResult, card.wordId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!word) return;

      if (e.key === 'e' || e.key === 'E') {
        if (document.activeElement === inputRef.current) return;
        e.preventDefault();
        setShowExample(v => !v);
        return;
      }

      if ((isRevealed || gradeResult) && !e.shiftKey && e.key === 'p') {
        if (document.activeElement === inputRef.current) return;
        e.preventDefault();
        playAudio(word.audioPt);
      } else if (e.key === 'P' && e.shiftKey) {
        e.preventDefault();
        playAudio(word.audioExamplePt);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isRevealed, gradeResult, word, playAudio]);

  if (!word) return null;

  const promptWord = card.direction === 'pt_to_pl' ? word.pt : word.pl;
  const answerWord = card.direction === 'pt_to_pl' ? word.pl : word.pt;

  function getAcceptedAnswers(): string[] {
    const primary = answerWord;
    const answers = [primary];
    if (word!.notes) {
      const match = word!.notes.match(/Synonimy:\s*(.+)/i);
      if (match) {
        answers.push(...match[1]!.split(';').map(s => s.trim()));
      }
    }
    return answers;
  }

  function handleTypedSubmit() {
    if (!typedInput.trim()) return;
    const result = gradeMultiple(getAcceptedAnswers(), typedInput);
    setGradeResult(result);
    setOverrideRating(result.rating);
    playAudio(word!.audioPt);
  }

  async function handleSpeak() {
    if (listening) return;
    setListening(true);
    const result = await recognizePortuguese({ timeoutMs: 6000 });
    setListening(false);

    if (!result || result.transcripts.length === 0) {
      setGradeResult({ rating: 1, verdict: 'wrong', expected: answerWord, userInput: '', note: "Didn't catch that — try again" });
      setOverrideRating(1);
      return;
    }

    const accepted = getAcceptedAnswers();
    let best: GradeResult | null = null;
    let bestTranscript = '';
    for (const t of result.transcripts) {
      const r = gradeMultiple(accepted, t.text);
      if (!best || r.rating > best.rating) {
        best = r;
        bestTranscript = t.text;
      }
    }
    setGradeResult({ ...best!, userInput: bestTranscript });
    setOverrideRating(best!.rating);
    playAudio(word!.audioPt);
  }

  function handleFinalRate(rating: 1 | 2 | 3 | 4) {
    const userAnswer = gradeResult?.userInput || (mode === 'typed' ? typedInput : undefined);
    onRate(rating, mode, userAnswer);
    setTypedInput('');
    setGradeResult(null);
    setOverrideRating(null);
  }

  const canSpeak = card.direction === 'pl_to_pt' && isSttAvailable();

  const renderImage = () => {
    const clickHandler = mode === 'self_rate' ? onReveal : undefined;
    const cursorClass = mode === 'self_rate' ? 'cursor-pointer' : '';

    if (word.imageStrategy === 'none') {
      return (
        <div onClick={clickHandler} className={`w-[640px] h-[640px] max-w-full aspect-square rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center ${cursorClass}`}>
          <span className="text-5xl font-semibold text-stone-600 dark:text-stone-300 text-center px-4 leading-tight">{word.pt}</span>
        </div>
      );
    }
    if (word.imageFile) {
      return (
        <div onClick={clickHandler} className={`w-[640px] h-[640px] max-w-full aspect-square rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 ${cursorClass}`}>
          <img src={`/${word.imageFile}`} alt="" width={640} height={640} loading="lazy" className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-6xl font-light text-stone-400 dark:text-stone-600 flex items-center justify-center w-full h-full">${word.pt.charAt(0).toUpperCase()}</span>`; }} />
        </div>
      );
    }
    return (
      <div onClick={clickHandler} className={`w-[640px] h-[640px] max-w-full aspect-square rounded-xl bg-stone-200 dark:bg-stone-800 flex items-center justify-center ${cursorClass}`}>
        <span className="text-6xl font-light text-stone-400 dark:text-stone-600 select-none">{word.pt.charAt(0).toUpperCase()}</span>
      </div>
    );
  };

  const renderVerdictBadge = () => {
    if (!gradeResult) return null;
    const colors = {
      exact: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      diacritics: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      typo: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      wrong: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    };
    const labels = { exact: 'Correct', diacritics: 'Almost — accent', typo: 'Almost — typo', wrong: 'Not quite' };
    return (
      <div className={`inline-block px-3 py-1 rounded-lg text-sm font-medium mb-3 ${colors[gradeResult.verdict]}`}>
        {labels[gradeResult.verdict]}
        {gradeResult.note && <span className="ml-2 font-normal opacity-80">{gradeResult.note}</span>}
      </div>
    );
  };

  const renderAnswer = () => (
    <div className="w-full text-center">
      {renderVerdictBadge()}
      <div className="flex items-center justify-center gap-3 mb-4">
        <h2 className={`text-5xl font-semibold ${card.direction === 'pt_to_pl' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{answerWord}</h2>
        {card.direction === 'pl_to_pt' && (
          <button onClick={() => playAudio(word.audioPt)} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-xl" title="Play word (P)">🔊</button>
        )}
      </div>
      <RatingButtons onRate={handleFinalRate} activeRating={overrideRating} />
      <button onClick={() => setShowExample(v => !v)} className="mt-4 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300" title="Toggle example (E)">
        {showExample ? 'Hide example' : 'Show example (E)'}
      </button>
    </div>
  );

  return (
    <div className="relative flex flex-col items-center">
      {showExample && (
        <div className="absolute right-full mr-6 top-0 w-96 bg-stone-100 dark:bg-stone-800 rounded-lg p-6">
          <p className="text-2xl text-stone-700 dark:text-stone-200">{word.examplePt}</p>
          <p className="text-2xl text-stone-500 dark:text-stone-400 mt-4">{word.examplePl}</p>
          {word.notes && <p className="text-lg text-stone-400 dark:text-stone-500 italic mt-5">{word.notes}</p>}
        </div>
      )}

      {renderImage()}

      <div className="mt-10">
        {mode === 'self_rate' && !isRevealed && !gradeResult && (
          <h2 className="text-5xl font-semibold">{promptWord}</h2>
        )}

        {mode === 'self_rate' && isRevealed && renderAnswer()}

        {mode === 'typed' && !gradeResult && (
          <div className="text-center">
            <h2 className="text-5xl font-semibold mb-6">{promptWord}</h2>
            <form onSubmit={e => { e.preventDefault(); handleTypedSubmit(); }} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={typedInput}
                onChange={e => setTypedInput(e.target.value)}
                placeholder={card.direction === 'pt_to_pl' ? 'Wpisz po polsku...' : 'Escreve em português...'}
                className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-lg w-64"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" className="px-4 py-2 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 rounded-lg font-medium">Check</button>
            </form>
          </div>
        )}

        {mode === 'typed' && gradeResult && renderAnswer()}

        {mode === 'spoken' && !gradeResult && (
          <div className="text-center">
            <h2 className="text-5xl font-semibold mb-6">{promptWord}</h2>
            <button
              onClick={handleSpeak}
              disabled={listening}
              className={`px-6 py-3 rounded-lg font-medium text-lg ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900'}`}
            >
              {listening ? 'Listening...' : '🎤 Speak'}
            </button>
            {!canSpeak && <p className="text-xs text-stone-400 mt-2">Speech recognition unavailable in this browser.</p>}
          </div>
        )}

        {mode === 'spoken' && gradeResult && renderAnswer()}
      </div>

      <div className="mt-6 flex gap-2">
        {(['self_rate', 'typed', 'spoken'] as const).map(m => {
          const disabled = m === 'spoken' && !canSpeak;
          const labels = { self_rate: 'Reveal', typed: 'Type', spoken: 'Speak' };
          const keys = { self_rate: 'R', typed: 'T', spoken: 'M' };
          return (
            <button
              key={m}
              onClick={() => !disabled && setMode(m)}
              disabled={disabled}
              className={`text-xs px-3 py-1.5 rounded-lg ${mode === m ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900' : 'bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-400'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={disabled ? 'Speech recognition not available' : `Switch to ${labels[m]} (${keys[m]})`}
            >
              {labels[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
