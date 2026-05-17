export type RecognitionResult = {
  transcripts: { text: string; confidence: number }[];
};

export function isSttAvailable(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export async function recognizePortuguese(
  options: { timeoutMs?: number } = {}
): Promise<RecognitionResult | null> {
  const SpeechRecognition = (window as unknown as Record<string, unknown>)['SpeechRecognition']
    || (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'];

  if (!SpeechRecognition) return null;

  const rec = new (SpeechRecognition as new () => SpeechRecognition)();
  rec.lang = 'pt-PT';
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 3;

  const timeout = options.timeoutMs ?? 5000;

  return new Promise<RecognitionResult | null>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        rec.stop();
        resolve(null);
      }
    }, timeout);

    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      const transcripts: { text: string; confidence: number }[] = [];
      for (let i = 0; i < event.results[0]!.length; i++) {
        const alt = event.results[0]![i]!;
        transcripts.push({ text: alt.transcript, confidence: alt.confidence });
      }
      resolve({ transcripts });
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      console.warn('Speech recognition error:', event.error);
      resolve(null);
    };

    rec.onend = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(null);
      }
    };

    rec.start();
  });
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}
