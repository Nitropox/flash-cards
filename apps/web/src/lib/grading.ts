export type GradeResult = {
  rating: 1 | 2 | 3 | 4;
  verdict: 'exact' | 'diacritics' | 'typo' | 'wrong';
  expected: string;
  userInput: string;
  note?: string;
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.!?,;:]+$/g, '');
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

export function gradeTyped(expected: string, userInput: string): GradeResult {
  const normExpected = normalize(expected);
  const normInput = normalize(userInput);

  if (normExpected === normInput) {
    return { rating: 3, verdict: 'exact', expected, userInput };
  }

  const strippedExpected = stripDiacritics(normExpected);
  const strippedInput = stripDiacritics(normInput);

  if (strippedExpected === strippedInput) {
    return { rating: 2, verdict: 'diacritics', expected, userInput, note: `Watch the accent: ${expected}` };
  }

  if (strippedExpected.length >= 4 && levenshtein(strippedExpected, strippedInput) <= 2) {
    return { rating: 2, verdict: 'typo', expected, userInput, note: `Close — correct: ${expected}` };
  }

  return { rating: 1, verdict: 'wrong', expected, userInput };
}

export function gradeMultiple(acceptedAnswers: string[], userInput: string): GradeResult {
  let best: GradeResult | null = null;
  for (const ans of acceptedAnswers) {
    const result = gradeTyped(ans, userInput);
    if (!best || result.rating > best.rating) {
      best = result;
    }
    if (best.rating === 3) break;
  }
  return best!;
}
