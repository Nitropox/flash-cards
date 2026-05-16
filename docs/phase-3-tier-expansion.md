# Phase 3 — Tier Expansion (300 / 500 / 1000) + Browse & Detail

> **Prerequisites:** Phases 1 and 2 complete. Pipelines run cleanly. Read `00-overview.md`.

## Goal

- Generate content for tiers 300, 500, and 1000.
- Build the Browse page (list/grid of words in current tier).
- Build the Word Detail page.
- Implement lazy-loading of tier data (don't bundle all of it eagerly).
- Improve the first-run experience with a proper intro.

---

## 1. Generate Content for Tiers 300 / 500 / 1000

Run the Phase 2 pipelines:

```
npm run data:wordlist                          # produces words-raw with all tiers
npm run data:translate                         # translates all untranslated entries
npm run data:images -- --tier 1000             # generates images for tiers ≤ 1000
npm run data:audio   -- --tier 1000            # generates audio for tiers ≤ 1000
npm run data:bundle                            # emits tier-{300,500,1000}.json
```

### Expected cost

| Tier | Entries | Images (≠none) | Image cost | Audio chars (both voices) | Audio cost |
|---|---|---|---|---|---|
| 10 | 10 | ~8 | $0.024 | ~3K | free |
| 100 | 90 | ~70 | $0.21 | ~22K | free |
| 300 | 200 | ~180 | $0.54 | ~50K | free |
| 500 | 200 | ~190 | $0.57 | ~50K | free |
| 1000 | 500 | ~480 | $1.44 | ~125K | free |
| **Subtotal Phase 3** | **900** | **~850** | **~$2.55** | **~225K** | **free (under 500K monthly)** |

Cumulative through Phase 3: ~$2.80 in content costs. Well under budget.

If R2 storage cost matters (it's ~$0.015/GB/month): 1000 entries × 4 files × ~40 KB ≈ 160 MB → free tier (10 GB).

---

## 2. Lazy Tier Loading

Update `src/lib/ingest.ts`:

```ts
async function loadTierIntoDb(tier: 10|100|300|500|1000|3000|10000) {
  if (await db.words.where('tier').belowOrEqual(tier).count() > expectedCountForTier(tier)) return;
  const mod = await import(`../data/tier-${tier}.json`);
  await db.transaction('rw', db.words, db.cards, async () => {
    for (const w of mod.default) {
      const existing = await db.words.get(w.id);
      if (!existing) {
        await db.words.add(w);
        await db.cards.bulkAdd([
          createInitialCard(w.id, 'pt_to_pl'),
          createInitialCard(w.id, 'pl_to_pt'),
        ]);
      }
    }
  });
}
```

Vite handles the dynamic `import()` with code-splitting automatically; each tier becomes a separate chunk.

When user advances tier in Settings:
- Confirmation modal: "Add ~N new words to your queue?"
- On confirm: call `loadTierIntoDb(newTier)`, update `settings.currentTier`, redirect to dashboard.

When tier data isn't yet generated (e.g. tier 3000 in Phase 3), show a "Coming soon — generate this tier first via build pipeline" message.

---

## 3. Browse Page (`/browse`)

URL: `/browse?tier=100&filter=all`

### 3.1 Layout

- Top: filter bar
  - Tier selector: dropdown (only tiers ≤ `settings.currentTier` are selectable, others greyed)
  - Filter pills: All / New / Learning / Review / Mastered / Suspended
  - Search box: filters by `pt` or `pl` substring (case + diacritics insensitive)
  - Sort: Frequency / Alphabetical (pt) / Recently introduced / Hardest (lowest stability)
- Body: grid of cards, 4 columns desktop, 2 columns narrow

### 3.2 Word card (in grid)

Each card shows:
- Thumbnail (64×64) of the image, or initial letter if `imageStrategy === "none"`
- Portuguese word in medium type
- Polish translation in small type below
- Status pill: New / Learning / Review (with days till due) / Mastered / Suspended
- Click → `/word/:id`

### 3.3 Performance

For tier 1000+, may have 1000+ cards on screen. Use **virtualized list** (e.g. `@tanstack/react-virtual`) for the grid. Load Card data + Word data together with a single Dexie query, indexed.

---

## 4. Word Detail Page (`/word/:id`)

Read-only deep view of one entry.

### 4.1 Layout

```
+--------------------------------------+
|  ← Back to browse                    |
|                                      |
|  [    LARGE IMAGE 320x320     ]      |
|                                      |
|  casa          🔊                    |
|  (rzecz. żeński)                     |
|                                      |
|  dom                                 |
|                                      |
|  Example:                            |
|  A minha casa é grande.  🔊          |
|  Mój dom jest duży.                  |
|                                      |
|  Notes:                              |
|  Rodzaj: rodzaj żeński (a casa).     |
|                                      |
|  ----                                |
|  Review status                       |
|  PT → PL:  Review · due in 4 days    |
|            stability: 12.3d          |
|  PL → PT:  Learning · due in 1h      |
|            stability: 1.2d           |
|                                      |
|  [Suspend both]  [Reset both]        |
+--------------------------------------+
```

### 4.2 Suspend / Reset

- **Suspend**: sets `card.suspended = true` on both directions. Confirmation dialog.
- **Reset**: deletes both cards, recreates with `state: New`. Confirmation dialog with warning.

These actions are needed for cards the user already knows or wants to start over on.

---

## 5. First-Run Experience

When app first opens with empty IndexedDB, show a 3-step onboarding instead of jumping straight to seeded state.

### Step 1: Welcome

```
Hello! pt-cards helps you learn European Portuguese
through image-anchored flashcards with spaced repetition.

You'll start with 10 essential words today. The app will
introduce more words gradually as your memory strengthens.
```

[Continue]

### Step 2: Pace

```
How many new words per day?

  ○ Light    (5 new)  — gentler ramp, ~10 min/day
  ● Standard (10 new) — recommended, ~20 min/day
  ○ Intense  (20 new) — aggressive, ~40 min/day

You can change this anytime in Settings.
```

[Continue]

### Step 3: Preferred answer mode

```
How do you want to answer?

  ● Self-rate    — see the answer, rate how well you knew it
  ○ Type         — type the answer, app grades automatically
  ○ Speak        — speak the answer, app uses voice recognition

You can switch per-card during sessions.
```

[Start learning]

After step 3:
- Persist `settings.newCardsPerDay`, `settings.defaultAnswerMode`.
- Trigger `loadTierIntoDb(10)`.
- Redirect to `/learn` with tier 10 cards ready.

Skip onboarding if `settings` table already has a row.

---

## 6. Settings: Tier Advance UI

Add to the existing Settings page:

```
Current tier: 100

  ▣ Tier 10   — 10/10 mastered ✓
  ▣ Tier 100  — 67/90 in review, 12 mastered

  Available to unlock:
  □ Tier 300  — 200 new words   [Add to queue]
  □ Tier 500  — (locked until Tier 300 is added)
  □ Tier 1000 — (locked)
```

Locking rule: a tier is unlocked only when the previous tier is `currentTier` or already added.

Recommendation banner (separate component): if ≥80% of `currentTier` cards have `state === "Review"` and average stability ≥ 21 days, show a green banner at top of dashboard:

> "You're cruising through Tier 100. Ready for Tier 300?" [Advance]

Recommendation is suggestive, not enforced. User can advance at any time.

---

## 7. Acceptance Criteria

- [ ] All scripts succeed for tiers up to 1000; final bundled JSON files contain expected entry counts.
- [ ] App lazy-loads tier-300/500/1000 JSON only when the user advances (verify in DevTools network tab — separate chunks).
- [ ] Browse page renders 1000+ cards smoothly (virtualized).
- [ ] Filters and search work correctly; sort changes order.
- [ ] Word detail page shows image, audio, both translations, example, notes, and per-direction FSRS state.
- [ ] Suspend / Reset actions work and persist.
- [ ] First-run onboarding flows correctly for a fresh IndexedDB.
- [ ] Tier advance UI correctly gates by previous tier completion.
- [ ] Recommendation banner appears in dashboard when conditions are met (force conditions in dev tools to test).
- [ ] Total cumulative generation cost ≤ USD 5.

---

## 8. Risks / Things to Watch

- **Bundle size**: each tier JSON could grow to 200-500 KB. Vite code-splitting handles this, but verify in build output that no tier ends up in the main chunk.
- **IndexedDB write performance**: bulk-loading 1000 entries should use `db.transaction()` and `bulkAdd()`, not single inserts in a loop. Test on a slow machine.
- **Browse virtualization**: react-virtual requires fixed row heights; if word cards have variable heights, use `react-virtuoso` instead.
- **Image cache**: at 1000 entries × 80 KB = 80 MB of images. Vercel free tier is fine for now, but track cumulative size and consider moving images to R2 when approaching 1 GB.

---

## 9. Definition of Done

The user can browse and inspect any of the 1000 words/phrases, advance through tiers smoothly with a clean onboarding flow, and the app has a real first-run experience. Stop here, await user approval, before Phase 4.
