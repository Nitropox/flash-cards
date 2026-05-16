# Phase 4 — Answer Modes (Typed + Spoken)

> **Prerequisites:** Phases 1–3 complete. Read `00-overview.md`.

## Goal

Add typed-answer and spoken-answer modes to the session player, with automatic grading that maps to FSRS ratings. The user can switch modes per-card mid-session.

---

## 1. Mode Switching UI

In the session player, above the card, add a 3-button toggle group:

```
[ 👁 Reveal ]   [ ⌨ Type ]   [ 🎤 Speak ]
```

- The currently-active mode is highlighted.
- Default comes from `settings.defaultAnswerMode`.
- User can switch at any time before answering. Switching after answering does nothing.
- Spoken mode is disabled (greyed with tooltip) if `SpeechRecognition` is unavailable. Spoken mode is only offered when `direction === "pl_to_pt"` (you speak Portuguese).

Keyboard:
- `T` switches to type mode
- `M` switches to speak mode
- `R` switches to reveal/self-rate mode

---

## 2. Typed Mode

### 2.1 UI

Front of card shows image + prompt word + a text input below.

```
  [    IMAGE     ]

   dom

  Wpisz po portugalsku:
  +-----------------------------+
  |                             |
  +-----------------------------+
  [Enter to check]
```

- Input is autofocused.
- Placeholder: "Wpisz po portugalsku:" or "Type in Portuguese:" depending on direction.
- Pressing `Enter` triggers grading.

For `pt_to_pl` direction, prompt is in Portuguese; user types in Polish.
For `pl_to_pt` direction, prompt is in Polish; user types in Portuguese.

### 2.2 Grading logic (`src/lib/grading.ts`)

```ts
type GradeResult = {
  rating: 1 | 2 | 3 | 4;     // FSRS rating
  verdict: "exact" | "diacritics" | "typo" | "wrong";
  expected: string;
  userInput: string;
  note?: string;             // human-readable hint, e.g. "Watch the accent: não"
};

export function gradeTyped(expected: string, userInput: string, direction: Direction): GradeResult;
```

Algorithm:

1. Normalize both: trim, lowercase, strip trailing punctuation.
2. **Exact match** → `rating: 3 (Good)`, `verdict: "exact"`.
3. Strip diacritics from both (`'nfd'.normalize` + remove combining marks):
   - If they match → `rating: 2 (Hard)`, `verdict: "diacritics"`,
     `note: "Almost — watch the accent: ${expected}"`.
4. Compute Levenshtein distance on the stripped form:
   - If ≤2 AND length(expected) ≥ 4 → `rating: 2 (Hard)`, `verdict: "typo"`,
     `note: "Almost — correct form: ${expected}"`.
5. Otherwise → `rating: 1 (Again)`, `verdict: "wrong"`.

Use `fast-levenshtein` or similar (small npm package).

### 2.3 Multiple-acceptable-answers

For `pt → pl`, some entries have multiple valid Polish translations. Convention: the `pl` field is the primary; alternatives are listed in `notes` as `Synonimy: dom; mieszkanie`. Parser:

```ts
function getAcceptedAnswers(entry: WordEntry, direction: Direction): string[] {
  const primary = direction === 'pt_to_pl' ? entry.pl : entry.pt;
  const alts = parseSynonymsFromNotes(entry.notes); // returns string[] or []
  return [primary, ...alts];
}
```

Grade against each, return the best result (lowest rating wins for the user).

### 2.4 After grading

- Show the back of the card immediately (full reveal — image, both words, example, audio plays).
- Show the verdict pill on top:
  - "✓ Correct" (green) for exact
  - "✓ Almost — accent matters" (yellow) for diacritics
  - "✓ Almost — small typo" (yellow) for typo
  - "✗ Not quite" (red) with the expected answer for wrong
- Display the auto-assigned rating button as pre-pressed.
- User can press `1` `2` `3` `4` to override before pressing `Space` / `Enter` to continue.

This preserves user agency — if you typed "casa" but were thinking "house" and just got lucky, you can bump down to Hard manually.

---

## 3. Spoken Mode

Only available for `pl_to_pt` direction (you say a Portuguese word in response to a Polish prompt). For `pt_to_pl`, hide the speak button.

### 3.1 Web Speech API wrapper (`src/lib/speech.ts`)

```ts
type RecognitionResult = {
  transcripts: { text: string; confidence: number }[];  // up to 3 alternatives
};

export function isSttAvailable(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export async function recognizePortuguese(
  options: { timeoutMs?: number } = {}
): Promise<RecognitionResult | null>;
```

Implementation:

```ts
const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const rec = new Ctor();
rec.lang = 'pt-PT';
rec.continuous = false;
rec.interimResults = false;
rec.maxAlternatives = 3;
```

Listen for:
- `onresult` — collect alternatives, resolve with array
- `onerror` — reject with error code (`no-speech`, `audio-capture`, `not-allowed`, `network`, `language-not-supported`)
- `onend` — fallback resolve with empty array if no result yet

Timeout: if no `onresult` within `options.timeoutMs ?? 5000`, stop recognition and resolve null.

### 3.2 UI Flow

Front of card:

```
  [    IMAGE     ]

   dom

  [ 🎤 Trzymaj i mów ]
```

- Press-and-hold microphone button OR click to start listening (toggle).
- While listening, button pulses, label changes to "Słucham…".
- After result, run all transcripts through `gradeTyped()` and pick the best rating across alternatives.

### 3.3 Permissions

On first use, browser will prompt for microphone access. If denied:
- Show toast: "Microphone access denied. Speak mode disabled. Enable in browser settings."
- Auto-fallback to typed mode for this card.

### 3.4 STT errors

- `no-speech`: "Didn't catch that — try again or switch to typed mode."
- `network`: "Speech recognition needs internet. Switching to typed mode."
- `language-not-supported`: "pt-PT not supported in this browser. Switching to typed mode."
- Other: log to console, fall back to typed mode.

### 3.5 Privacy disclosure

In Settings, near the spoken-mode toggle, add a small note:

> Note: in Chrome and Edge, speech recognition sends audio to Google's servers for processing. Audio is not stored by this app, but is processed externally. Use typed mode if you prefer fully local.

---

## 4. Updated Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Reveal (front) / Next (back, after rating) |
| `Enter` | Submit typed answer (when in type mode and input focused) |
| `1` `2` `3` `4` | Again / Hard / Good / Easy (after reveal) |
| `R` | Switch to reveal mode |
| `T` | Switch to type mode |
| `M` | Switch to speak mode / toggle mic |
| `P` | Replay word audio |
| `Shift+P` | Replay example audio |
| `S` | Suspend current card |
| `Esc` | Exit session (confirm if mid-card) |

---

## 5. Review Log Enhancements

When grading via typed or spoken mode, populate the `ReviewLog`:

```ts
{
  cardId,
  rating,
  reviewedAt: now,
  elapsedDaysAtReview,
  answerMode: 'typed' | 'spoken',
  userAnswer: rawUserInput,
  durationMs: now - revealStartTime,
}
```

This data feeds the stats page (Phase 5) — e.g. accuracy per mode, common misspellings, words you always trip on.

---

## 6. Acceptance Criteria

- [ ] Mode switcher visible above the card; toggling works correctly.
- [ ] Typed mode: exact match → Good; diacritics-only difference → Hard with note; small typo → Hard with correct form; wrong → Again.
- [ ] User can override the auto-rating before continuing.
- [ ] Multiple-translation entries accept any listed alternative.
- [ ] Spoken mode disabled when `SpeechRecognition` is unavailable, with tooltip.
- [ ] Spoken mode disabled for `pt_to_pl` direction.
- [ ] Speaking a Portuguese word correctly registers as Good.
- [ ] Mic permission denial gracefully falls back to typed mode for the current card.
- [ ] STT timeout (5s no speech) handled gracefully.
- [ ] Settings default mode persists and is used on session start.
- [ ] ReviewLog records `userAnswer` and `answerMode` correctly.
- [ ] All keyboard shortcuts work as specified.

---

## 7. Risks / Things to Watch

- **Browser support**: Web Speech API is reliable in Chrome and Edge; Safari support exists but quality varies. Firefox does not support it. Detect and disable rather than fail.
- **Pronunciation tolerance**: Google's pt-PT recognizer is decent but not perfect for non-native speakers. Don't be too strict — if Levenshtein ≤ 2 catches it, that's fine.
- **Diacritics input**: Polish keyboards have polish diacritics, not Portuguese. The user will likely type "nao" not "não" — that's why diacritics-tolerant grading is essential.
- **Multi-word phrases**: typed grading of "estar com fome" needs trim-internal-whitespace normalization. STT may return "estar com fome" or "estar com a fome" — accept both (Levenshtein handles).
- **`obrigado` vs `obrigada`**: don't grade as wrong. Add the alt to notes / accept both. The user has accepted the male form by default.

---

## 8. Definition of Done

The user can choose any of three answer modes per card, with grading that's strict enough to be useful and lenient enough not to be punitive. Stop here, await user approval, before Phase 5.
