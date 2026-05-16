# pt-cards — Project Overview & Shared Context

> **Read this first.** Every phase document references this file for the binding tech stack, data model, and repository structure. Do not change choices here without explicit user approval.

**Project codename:** `pt-cards`
**Owner:** Single user (developer = user)
**Languages:** Polish (pl-PL, source) ↔ European Portuguese (pt-PT, target)

---

## 1. Project Overview

A single-user, browser-based vocabulary learning application for **European Portuguese** (pt-PT). The user's native language is **Polish** (pl-PL). The app uses image-anchored flashcards with the FSRS spaced repetition algorithm to drive long-term retention.

**Primary goal:** Take the user from ~50 words to passive comprehension of ~3000–10000 most frequent pt-PT words and common phrases over months/years of consistent practice.

**Hard constraints:**
- Browser-only, desktop/laptop only (responsive is fine, but no native-mobile gestures).
- Single user. No authentication, no multi-tenancy. Data is local-first (IndexedDB).
- One-time content generation budget: **USD 50**.
- European Portuguese (pt-PT) **only** — not Brazilian (pt-BR). All audio, voice options, vocabulary, and example sentences must respect this.

---

## 2. Phase Index

| Phase | File | Goal |
|---|---|---|
| 1 | `phase-1-skeleton.md` | Working SPA with FSRS, 10 hardcoded words, self-rate mode |
| 2 | `phase-2-tier1-content.md` | Content pipelines (images, audio, translations), tier 1+100 live |
| 3 | `phase-3-tier-expansion.md` | Tiers 300/500/1000, browse & detail pages |
| 4 | `phase-4-answer-modes.md` | Typed + spoken answer modes |
| 5 | `phase-5-stats-polish.md` | Stats page, PWA, polish |
| 6 | `phase-6-higher-tiers.md` | Tiers 3000 and 10000, on-demand generation |

Each phase is independently deployable.

---

## 3. Tech Stack (binding decisions)

| Concern | Choice | Rationale |
|---|---|---|
| Build tool | Vite | Fast HMR, simple config |
| Framework | React 18 + TypeScript (strict) | Standard, well-documented |
| Styling | Tailwind CSS | Speed of iteration |
| State management | Zustand | No boilerplate, persists easily to IndexedDB |
| Local storage | IndexedDB via **Dexie.js** | Stores words, FSRS state, image blobs, audio blobs |
| Spaced repetition | **ts-fsrs** (npm) | Modern FSRS implementation in TypeScript |
| Routing | React Router v6+ | Simple SPA routing |
| PWA | `vite-plugin-pwa` | Offline support, installable as desktop app (Phase 5) |
| Hosting | Vercel (or Netlify / Cloudflare Pages) | Free tier, zero-config |
| Asset hosting (audio) | **Cloudflare R2** | Audio bundle exceeds Vercel free tier from Phase 2 onward |
| Image generation (build-time) | **Flux Schnell via fal.ai** | ~$0.003/image, good quality |
| TTS pre-generation (build-time) | **Azure Speech Service**, voices `pt-PT-RaquelNeural` and `pt-PT-DuarteNeural` | Free tier covers full need; pt-PT voices are excellent |
| STT runtime | **Web Speech API** (`lang="pt-PT"`) | Free, browser-native |
| Translation (build-time) | Anthropic Claude API | Better pt-PT disambiguation than DeepL |

**Do not introduce a backend server.** Build-time Node.js scripts generate content; the final app is a static SPA + asset bundle + IndexedDB.

---

## 4. Repository Structure

```
pt-cards/
├── apps/web/                          # Vite React app
│   ├── src/
│   │   ├── components/                # UI components
│   │   ├── pages/                     # Route-level views
│   │   ├── stores/                    # Zustand stores
│   │   ├── lib/
│   │   │   ├── db.ts                  # Dexie schema & DB instance
│   │   │   ├── fsrs.ts                # ts-fsrs wrapper + scheduling logic
│   │   │   ├── speech.ts              # Web Speech API wrapper (STT + audio playback)
│   │   │   ├── grading.ts             # Auto-grading: typed and spoken answers
│   │   │   └── ingest.ts              # First-run ingestion from bundled JSON
│   │   ├── data/                      # Bundled word data (JSON) at build time
│   │   └── main.tsx
│   ├── public/
│   │   ├── images/                    # Generated images (served by Vercel)
│   │   └── audio/                     # Generated MP3s (mirrored to R2 in Phase 2+)
│   └── package.json
├── scripts/                           # Node.js build-time pipelines
│   ├── 01-assemble-wordlist.ts        # Merges sources → canonical word list
│   ├── 02-translate.ts                # PL translations via Claude API
│   ├── 03-generate-images.ts          # fal.ai Flux Schnell → public/images/
│   ├── 04-generate-audio.ts           # Azure TTS → public/audio/ + R2
│   ├── 05-bundle-data.ts              # Emits final src/data/*.json
│   └── lib/                           # Shared script utilities
├── data/
│   ├── sources/                       # Raw frequency lists (gitignored)
│   └── manifests/                     # Generation manifests (idempotency)
├── .env.example
└── README.md
```

---

## 5. Canonical Data Model

### 5.1 Word entry (built at build time, bundled as JSON, ingested into IndexedDB on first run)

```ts
type WordEntry = {
  id: string;                          // stable slug, e.g. "casa-1" or "estar-com-fome"
  type: "word" | "phrase";
  pt: string;                          // "casa" / "estar com fome"
  pl: string;                          // "dom" / "być głodnym"
  partOfSpeech: "noun" | "verb" | "adj" | "adv" | "pron" | "prep" | "conj" | "det" | "interj" | "phrase" | "num";
  gender?: "m" | "f" | "mf";           // for nouns; mf = ambiguous (o/a artista)
  pluralPt?: string;                   // irregular plurals only
  conjugationHint?: string;            // 1st person sing. present for irregular verbs (e.g. "sou" for "ser")
  examplePt: string;                   // sentence in pt-PT
  examplePl: string;                   // Polish translation of the example
  frequencyRank: number;               // 1..10000 (lower = more common)
  tier: 10 | 100 | 300 | 500 | 1000 | 3000 | 10000;  // first tier this word appears in
  imageStrategy: "literal" | "scene" | "none"; // see Phase 2 doc for definitions
  imagePrompt?: string;                // prompt used (kept for regeneration)
  imageFile?: string;                  // relative path in /public/images, null if "none"
  audioPt: string;                     // relative path to mp3 (word itself)
  audioExamplePt: string;              // relative path to mp3 (example sentence)
  notes?: string;                      // free-form grammar/usage notes (pt-PT-specific quirks)
};
```

### 5.2 Card (per-direction review state, stored in IndexedDB)

A single `WordEntry` produces **two cards** (one per direction). Each card is independently scheduled by FSRS.

```ts
type Card = {
  id: string;                          // `${wordId}:${direction}`
  wordId: string;
  direction: "pt_to_pl" | "pl_to_pt";

  // FSRS state (from ts-fsrs)
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: "New" | "Learning" | "Review" | "Relearning";
  lastReview?: Date;

  // App-level
  suspended: boolean;                  // user-suspended cards skip reviews
  introducedAt?: Date;                 // first time user saw this card
  masteredAt?: Date;                   // when stability first exceeded 90 days
};
```

### 5.3 Review log

```ts
type ReviewLog = {
  id: string;                          // auto-incrementing
  cardId: string;
  rating: 1 | 2 | 3 | 4;               // Again | Hard | Good | Easy (FSRS)
  reviewedAt: Date;
  elapsedDaysAtReview: number;
  answerMode: "self_rate" | "typed" | "spoken";
  userAnswer?: string;                 // typed/spoken answer text (for grading audit)
  durationMs: number;
};
```

### 5.4 Settings (single-row table)

```ts
type Settings = {
  currentTier: 10 | 100 | 300 | 500 | 1000 | 3000 | 10000;
  newCardsPerDay: number;              // default 10, range 1–30
  maxReviewsPerSession: number;        // default 30
  targetRetention: number;             // FSRS parameter, default 0.90
  defaultAnswerMode: "self_rate" | "typed" | "spoken";
  ttsVoice: "Raquel" | "Duarte";
  ttsAutoPlay: boolean;                // default true
  showPhonetics: boolean;              // default false
  theme: "light" | "dark" | "system";
};
```

### 5.5 Dexie schema (single-file)

```ts
// src/lib/db.ts
db.version(1).stores({
  words: 'id, frequencyRank, tier, type',
  cards: 'id, wordId, due, state, suspended, [state+due]',
  reviewLog: '++id, cardId, reviewedAt',
  settings: 'key',                     // single-row "current" key
  imageBlobs: 'wordId',                // offline image cache (Phase 5)
  audioBlobs: 'key',                   // key = audio file path (Phase 5)
});
```

---

## 6. Word List Tiers

| Tier | Cumulative words | Reaches |
|---|---|---|
| 10 | 10 | Hand-curated survival set (see Phase 2 doc) |
| 100 | 100 | Top 100 most frequent (mostly function words + basics) |
| 300 | 300 | High-frequency verbs, nouns, adjectives |
| 500 | 500 | Conversational basics |
| 1000 | 1000 | A1 / early A2 |
| 3000 | 3000 | B1 |
| 10000 | 10000 | Comfortable reading of native content |

Tier progression is **manual** — user clicks "Advance" in settings. App may show a recommendation banner when ≥80% of current tier's cards are in `Review` state with average stability ≥ 21 days.

---

## 7. Out of Scope (do not build, even if asked mid-implementation)

- Mobile-specific UI / native-mobile gestures
- Multi-user / accounts / cloud sync
- Social features
- AI-generated example sentences at runtime (everything is pre-generated)
- Grammar lessons / structured curriculum
- Brazilian Portuguese support
- Languages other than Polish ↔ Portuguese
- User-authored cards
- Anki import/export

If the user requests any of the above during implementation, push back: this is a v2 feature.

---

## 8. Environment Variables

Used **only by Node scripts** in `scripts/` at build time. Never bake them into the client bundle.

```
# .env.local (gitignored)
FAL_API_KEY=...                # fal.ai (image generation)
AZURE_SPEECH_KEY=...           # Azure Speech Service (TTS)
AZURE_SPEECH_REGION=...        # e.g. westeurope
ANTHROPIC_API_KEY=...          # Claude API for translations & classification
R2_ACCOUNT_ID=...              # Cloudflare R2 (Phase 2+)
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=pt-cards-audio
```

---

## 9. Glossary

- **FSRS** — Free Spaced Repetition Scheduler. Modern, ML-derived replacement for SM-2.
- **Stability** — FSRS parameter: time in days until recall probability drops from 100% to 90%.
- **Difficulty** — FSRS per-card parameter: intrinsic hardness.
- **Retrievability** — Predicted probability of correct recall at a given moment.
- **Tier** — A vocabulary milestone (10, 100, 300, 500, 1000, 3000, 10000 most-frequent words).
- **Direction** — Either `pt_to_pl` (see Portuguese, recall Polish) or `pl_to_pt` (vice versa).
- **pt-PT** — European Portuguese. **pt-BR** — Brazilian Portuguese (out of scope).
- **PSE** — Picture Superiority Effect (cognitive science basis for image-anchored cards).
