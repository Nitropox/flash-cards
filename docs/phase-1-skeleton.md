# Phase 1 — Skeleton

> **Prerequisites:** Read `00-overview.md` first. This phase produces a working SPA you can use to review 10 hardcoded words, end-to-end.

## Goal

Deliver a deployed app where the user can:
- Open the URL on desktop Chrome.
- Start a session.
- See a card (image placeholder + Portuguese word).
- Click "Reveal", see Polish translation.
- Rate Again / Hard / Good / Easy.
- See the next due card show up tomorrow (FSRS scheduling working correctly).

No content pipelines, no audio, no typed/spoken answer modes, no PWA. Just the skeleton.

---

## 1. Project Initialization

```
npm create vite@latest pt-cards -- --template react-ts
cd pt-cards
```

Install dependencies:

```
npm i react-router-dom dexie zustand ts-fsrs clsx
npm i -D tailwindcss postcss autoprefixer @types/node tsx
npx tailwindcss init -p
```

Configure:
- `tailwind.config.js` — content paths, dark mode `"class"`
- `src/index.css` — `@tailwind base/components/utilities`
- `tsconfig.json` — `"strict": true`, `"noUncheckedIndexedAccess": true`
- ESLint + Prettier (use Vite defaults; add `eslint-config-prettier`)

---

## 2. Folder Structure (subset for Phase 1)

```
apps/web/src/
├── components/
│   ├── CardView.tsx                # Renders a single card front/back
│   ├── RatingButtons.tsx           # Again/Hard/Good/Easy
│   └── Layout.tsx                  # App shell, nav
├── pages/
│   ├── Dashboard.tsx
│   ├── Session.tsx
│   └── Settings.tsx
├── stores/
│   └── useSessionStore.ts          # current session queue + position
├── lib/
│   ├── db.ts                       # Dexie schema (see 00-overview.md §5.5)
│   ├── fsrs.ts                     # ts-fsrs wrapper
│   ├── session.ts                  # session composition logic
│   └── seed.ts                     # loads 10 hardcoded words on first run
├── data/
│   └── tier-10.json                # the 10 hand-curated entries (see §5)
├── App.tsx
└── main.tsx
```

---

## 3. Dexie Schema

Implement exactly as specified in `00-overview.md` §5.5. For Phase 1 only `words`, `cards`, `reviewLog`, and `settings` are populated; `imageBlobs` and `audioBlobs` exist but stay empty.

On app startup, check if `words` is empty; if so, run `src/lib/seed.ts` to bulk-load `tier-10.json` into the `words` table, then create two `Card` rows per word (one per direction) with FSRS initial state.

---

## 4. FSRS Integration (`src/lib/fsrs.ts`)

Wrap `ts-fsrs` with these exports:

```ts
import { FSRS, generatorParameters, type Card as FSRSCard, type Rating } from 'ts-fsrs';

const params = generatorParameters({
  request_retention: 0.90,
  maximum_interval: 36500,
});
export const fsrs = new FSRS(params);

export function makeNewCard(): Pick<Card, 'due'|'stability'|'difficulty'|'elapsedDays'|'scheduledDays'|'reps'|'lapses'|'state'>;
export function applyReview(card: Card, rating: 1|2|3|4, now: Date): { updatedCard: Card; log: Omit<ReviewLog,'id'> };
```

`ts-fsrs` exposes `createEmptyCard()` and `f.next(card, now, rating)` — wrap to map between its types and our `Card` shape. Use the `FSRSAlgorithm` v5 default parameters.

---

## 5. Tier 1 — Hand-Curated Word List

Create `src/data/tier-10.json` with these entries. Use placeholder paths for images and audio (they will be generated in Phase 2). For now, in the UI substitute a neutral icon (e.g. `<div>` with the word's first letter) when no image file exists.

```json
[
  {
    "id": "ola",
    "type": "word",
    "pt": "olá",
    "pl": "cześć",
    "partOfSpeech": "interj",
    "examplePt": "Olá, como estás?",
    "examplePl": "Cześć, jak się masz?",
    "frequencyRank": 1,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/ola/word.mp3",
    "audioExamplePt": "audio/raquel/ola/example.mp3"
  },
  {
    "id": "obrigado",
    "type": "word",
    "pt": "obrigado",
    "pl": "dziękuję",
    "partOfSpeech": "interj",
    "examplePt": "Muito obrigado pela ajuda.",
    "examplePl": "Bardzo dziękuję za pomoc.",
    "frequencyRank": 2,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/obrigado/word.mp3",
    "audioExamplePt": "audio/raquel/obrigado/example.mp3",
    "notes": "Forma męska. Kobieta mówi 'obrigada'. Karta dla kobiet: zob. id 'obrigada' (alternatywa)."
  },
  {
    "id": "por-favor",
    "type": "phrase",
    "pt": "por favor",
    "pl": "proszę",
    "partOfSpeech": "phrase",
    "examplePt": "Um café, por favor.",
    "examplePl": "Kawę, proszę.",
    "frequencyRank": 3,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/por-favor/word.mp3",
    "audioExamplePt": "audio/raquel/por-favor/example.mp3"
  },
  {
    "id": "sim",
    "type": "word",
    "pt": "sim",
    "pl": "tak",
    "partOfSpeech": "adv",
    "examplePt": "Sim, eu sei.",
    "examplePl": "Tak, wiem.",
    "frequencyRank": 4,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/sim/word.mp3",
    "audioExamplePt": "audio/raquel/sim/example.mp3"
  },
  {
    "id": "nao",
    "type": "word",
    "pt": "não",
    "pl": "nie",
    "partOfSpeech": "adv",
    "examplePt": "Não, obrigado.",
    "examplePl": "Nie, dziękuję.",
    "frequencyRank": 5,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/nao/word.mp3",
    "audioExamplePt": "audio/raquel/nao/example.mp3",
    "notes": "Nasalność końcowa. Akcent (~) ma znaczenie."
  },
  {
    "id": "bom-dia",
    "type": "phrase",
    "pt": "bom dia",
    "pl": "dzień dobry",
    "partOfSpeech": "phrase",
    "examplePt": "Bom dia! Posso ajudar?",
    "examplePl": "Dzień dobry! Mogę pomóc?",
    "frequencyRank": 6,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/bom-dia/word.mp3",
    "audioExamplePt": "audio/raquel/bom-dia/example.mp3"
  },
  {
    "id": "desculpe",
    "type": "word",
    "pt": "desculpe",
    "pl": "przepraszam",
    "partOfSpeech": "interj",
    "examplePt": "Desculpe, não percebi.",
    "examplePl": "Przepraszam, nie zrozumiałem.",
    "frequencyRank": 7,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/desculpe/word.mp3",
    "audioExamplePt": "audio/raquel/desculpe/example.mp3"
  },
  {
    "id": "eu-sou",
    "type": "phrase",
    "pt": "eu sou",
    "pl": "jestem",
    "partOfSpeech": "phrase",
    "examplePt": "Eu sou da Polónia.",
    "examplePl": "Jestem z Polski.",
    "frequencyRank": 8,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/eu-sou/word.mp3",
    "audioExamplePt": "audio/raquel/eu-sou/example.mp3",
    "notes": "Forma 1 os. l. poj. czasownika 'ser' (być, trwale)."
  },
  {
    "id": "como-estas",
    "type": "phrase",
    "pt": "como estás?",
    "pl": "jak się masz?",
    "partOfSpeech": "phrase",
    "examplePt": "Olá! Como estás hoje?",
    "examplePl": "Cześć! Jak się masz dzisiaj?",
    "frequencyRank": 9,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/como-estas/word.mp3",
    "audioExamplePt": "audio/raquel/como-estas/example.mp3",
    "notes": "Forma 'tu' (nieformalna). Formalnie: 'como está?'."
  },
  {
    "id": "adeus",
    "type": "word",
    "pt": "adeus",
    "pl": "do widzenia",
    "partOfSpeech": "interj",
    "examplePt": "Adeus, até amanhã.",
    "examplePl": "Do widzenia, do jutra.",
    "frequencyRank": 10,
    "tier": 10,
    "imageStrategy": "scene",
    "audioPt": "audio/raquel/adeus/word.mp3",
    "audioExamplePt": "audio/raquel/adeus/example.mp3",
    "notes": "Można też 'até logo' (do zobaczenia)."
  }
]
```

Note: `obrigado` is the male form. The user may be male or female; for Phase 1 we ship the male form, and the user can edit it manually after import if needed. (We do not build user editing UI in this phase.)

---

## 6. Session Composition (`src/lib/session.ts`)

Each session draws cards in this priority order, stopping when `maxReviewsPerSession` is reached or no eligible cards remain:

1. **Learning** / **Relearning** cards with `due <= now()` (FSRS learning steps are short — minutes/hours).
2. **Review** cards with `due <= now()`.
3. **New** cards (`state === "New"`) — up to today's remaining `newCardsPerDay` budget.

"Today" is computed in the user's local timezone with day boundary at **04:00 local time** (so late-night sessions count as the previous day for the new-card budget).

Query examples:

```ts
// Due reviews
db.cards.where('[state+due]')
  .between(['Review', new Date(0)], ['Review', now], true, true)
  .and(c => !c.suspended)
  .toArray();

// New cards in current tier
db.cards.where('state').equals('New')
  .and(async c => {
    const w = await db.words.get(c.wordId);
    return w?.tier <= settings.currentTier && !c.suspended;
  })
  .sortBy(c => /* lookup wordEntry.frequencyRank */);
```

### 6.1 New card introduction order

Within a tier, introduce new cards in `frequencyRank` ascending. **Interleave directions**: when introducing `casa`, first introduce `casa:pt_to_pl`. The `casa:pl_to_pt` card is held back and becomes eligible 24 hours later. Implement this by setting `pl_to_pt` cards' initial `due` to `introducedAt(pt_to_pl) + 24h` once their counterpart is first seen.

For Phase 1 with 10 words, this gives 10 new cards on day 1 (if `newCardsPerDay >= 10`) and another 10 the next day.

---

## 7. UI — Pages

### 7.1 Dashboard (`/`)

Show:
- Title "pt-cards"
- Streak count (days with ≥1 review). Phase 1: derive from `reviewLog` distinct dates.
- "Today: N reviews due, M new cards available"
- Current tier (just "Tier 10" badge for Phase 1)
- Large "Start session" button → `/learn`
- Nav link to `/settings`

Minimal styling — clean, centered card, single column, max-width ~640px.

### 7.2 Session (`/learn`)

On mount, build the session queue once (call `buildSessionQueue()` from `lib/session.ts`). Store queue + cursor in `useSessionStore`.

Card states in UI: **front**, **back**. Toggle with `Space` or click on image.

**Front view shows:**
- Image area (640×640, full width on smaller screens). Click to reveal.
- Prompt word in large type (`text-5xl`) below the image (Portuguese if `pt_to_pl`, Polish if `pl_to_pt`)
- No direction label, no reveal button — interaction is implicit (Space / click image)

**Back view shows:**
- Same image (click toggles back to front)
- Answer word only (`text-5xl`): blue for Polish, green for Portuguese
- Audio icon (🔊) only when answer is Portuguese (`pl_to_pt` direction)
- Rating buttons: **Again** (red), **Hard** (orange), **Good** (green), **Easy** (blue). Keyboard: `1` `2` `3` `4`.
- "Show example (E)" button below ratings — toggles example panel
- Example panel: absolutely positioned to the left of the card (does not shift layout), shows `examplePt`, `examplePl`, and `notes` in large font (`text-2xl`)
- After rating: advance to next card. When queue empties, show "All caught up" screen.

**Session queue rules:**
- Only one direction per word per session (never both `pt_to_pl` and `pl_to_pt` for the same word)
- `pl_to_pt` cards are not introduced until their `pt_to_pl` counterpart has been reviewed at least once

### 7.3 Settings (`/settings`)

For Phase 1, just these controls (persisted to `settings` table):

- `newCardsPerDay` (number input, default 10, range 1–30)
- `maxReviewsPerSession` (number input, default 30)
- `targetRetention` (slider 0.80 → 0.97, default 0.90)
- Theme (light/dark/system)
- **Reset progress** button (with confirm dialog): clears `cards` and `reviewLog`, re-seeds from JSON.

---

## 8. Keyboard Shortcuts (Phase 1)

In `/learn`:

| Key | Action |
|---|---|
| `Space` | Toggle reveal (front ↔ back) |
| `1` `2` `3` `4` | Again / Hard / Good / Easy (only when revealed) |
| `E` | Toggle example sentence panel |
| `P` | Play Portuguese word audio (when revealed) |
| `Shift+P` | Play example sentence audio (when revealed) |
| `Esc` | Exit session (confirm if mid-card) |

---

## 9. Local Run

- `npm run dev` starts the app in development mode with HMR.
- Test FSRS scheduling: review a card → "Good" → check IndexedDB in DevTools, confirm `due` is set ~10 minutes out (learning) or 1+ days out (review).

---

## 10. Acceptance Criteria

- [ ] `npm run dev` starts the app, opens dashboard with empty state on first run, then seeded state after.
- [ ] Clicking "Start session" opens `/learn` with a queue of new tier-10 cards.
- [ ] Each card displays Portuguese on `pt_to_pl` front, Polish on `pl_to_pt` front.
- [ ] Reveal shows both words, example sentence, and rating buttons.
- [ ] Rating updates the card in IndexedDB; next card loads; queue eventually empties.
- [ ] `pl_to_pt` direction for a given word does not appear in the same session as its `pt_to_pl` counterpart.
- [ ] Reloading the page mid-session resumes from the next due card.
- [ ] After a session, the dashboard reflects updated streak and remaining due/new counts.
- [ ] Settings changes persist.
- [ ] "Reset progress" wipes state and re-seeds tier 10.
- [ ] App runs locally via `npm run dev` without errors.

---

## 11. Risks / Things to Watch

- **FSRS state migration**: don't store `Date` as a string in IndexedDB — Dexie handles native Date fine, but JSON.stringify will break it. Keep types honest end-to-end.
- **Card uniqueness**: ensure `id` of cards is exactly `${wordId}:${direction}` to make idempotent re-seeding safe.
- **Day boundary**: write a unit test for "is `now` in the same day as `lastReview`" with the 04:00 cutoff. It's easy to get DST wrong.
- **Resetting**: the "Reset progress" button must also reset Zustand session state, not just IndexedDB.

---

## 12. Definition of Done

User can review the 10 tier-1 cards, see them scheduled out correctly per FSRS, and the app runs locally via `npm run dev`. Stop here, await user approval, before moving to Phase 2.
