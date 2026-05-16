# Phase 6 — Tiers 3000 and 10000

> **Prerequisites:** Phases 1–5 complete. App is the user's daily driver and they have progressed through tier 1000. Read `00-overview.md`.

## Goal

- Generate content for tiers 3000 and 10000.
- Add on-demand, cost-aware generation UI so the user can trigger generation themselves without running scripts locally.
- Track and display cumulative cost against the $50 budget.

This phase is split into two halves: Phase 6a (tier 3000) and Phase 6b (tier 10000). Treat them as separate releases; the user should spend months in tier 1000 before unlocking 3000.

---

## 1. Cost Projection

| Tier | New entries | Images | Image cost | Audio chars | Audio cost (if past free tier) |
|---|---|---|---|---|---|
| 3000 | 2000 | ~1700 | $5.10 | ~500K | $0–$8 |
| 10000 | 7000 | ~6000 | $18 | ~1.75M | $20–$28 |
| **Phase 6 total** | | | **$23** | | **$20–$36** |

Cumulative content cost (all phases): ~$26–$45. Stays under $50 budget. Audio costs are the variable — Azure free tier is 0.5M chars/month, so spreading generation over 4–5 months keeps audio free.

---

## 2. Generation: Two Paths

The user has two ways to generate higher-tier content.

### Path A: Local pipeline (recommended)

Same scripts as Phases 2 and 3, with `--tier 3000` or `--tier 10000`. User pulls latest, runs `npm run data:all -- --tier 3000`, commits the resulting JSON + audio manifest + R2 uploads, and pushes. Deploy.

This is the cheap, reliable path. The agent should ensure scripts work reliably for batches of this size:
- Resume from manifest on interruption
- Parallelism: 8 concurrent fal.ai requests, 4 concurrent Azure TTS
- Progress bars and ETA in console
- Budget guards: scripts must abort if a single run would exceed `--max-cost-usd` (default 25)

### Path B: In-app trigger (optional, only if user is on a different machine)

Build a `/admin` route (not in main nav, but accessible by URL) that:
- Shows current cumulative content costs (read from `data/manifests/`)
- Has a button "Generate tier 3000" that triggers a GitHub Action workflow via repository_dispatch event

The GitHub Action runs the same scripts in CI. After completion, deploys to Vercel. Secrets stay in GitHub.

This is bonus complexity — implement only if the user explicitly wants it. By default, ship Path A only.

---

## 3. App Changes

### 3.1 Settings: tier 3000 and 10000 cards

Update the tier list in Settings to include 3000 and 10000. Lock 3000 until 1000 is fully ingested; lock 10000 until 3000 is fully ingested.

Before allowing advance to 3000 or 10000, show a confirmation modal:

> "Tier 3000 adds 2000 new words. At default pace (10 new/day), this is ~7 months of new card introduction. Are you sure?"

Same for 10000 but with "~2 years".

### 3.2 Dashboard: budget tracker (only after tier 1000)

Small card at the bottom of dashboard:

```
Content generation costs
$2.80 / $50.00
■■░░░░░░░░░░░░░░░░░░ 5.6%
```

Updates from a static `costs.json` emitted by `scripts/05-bundle-data.ts` (summed from manifests). Hidden until tier 1000 is reached (no point showing it before).

### 3.3 Performance for 10000 cards

At full scale, IndexedDB holds:
- 10000 word entries
- 20000 cards
- Tens of thousands of review logs

Validate that:
- Session queue building stays under 200ms (use compound index `[state+due]`)
- Browse page virtualization handles 10000 entries without jank
- Stats page aggregations are memoized (`useMemo` + small in-memory cache)
- IndexedDB total storage stays under 200 MB on a typical browser

If any of these regress, optimize before shipping.

### 3.4 Audio cache eviction

At tier 10000, audio total is ~1.6 GB on R2 but locally cached audio could fill browser quota. Update the service worker to:
- Limit audio cache to 1000 most-recent entries
- Evict LRU when limit reached
- Show a "Storage almost full" hint in settings if `navigator.storage.estimate()` > 90% of quota

---

## 4. Source Quality at Tiers 3000+

At ranks 1000–10000, frequency data gets noisier and corpus-dependent. Be more careful:

- **Filter proper nouns** unless they're common (Portugal, Lisboa, Europa). Names of specific people, organizations, foreign places: skip.
- **Filter morphological duplicates**: if both `correr` and `correndo` show up, keep only the lemma form (`correr`) — the user will encounter inflected forms via examples, not as separate cards.
- **Filter pt-BR contaminants more aggressively**: rerun the European-filter check with tighter rules.
- **Manual sample review**: before committing the tier-3000 or tier-10000 JSON, sample 100 random entries and have the user spot-check for quality. Include this as a CLI step:

```
npm run data:bundle -- --review 100
```

Opens a local HTML page with 100 random entries shown side-by-side with images and audio for the user to flag.

---

## 5. Acceptance Criteria

### Phase 6a (tier 3000)

- [ ] Tier 3000 content generated; cumulative cost ≤ $10.
- [ ] Manual review of 100 random tier-3000 entries: ≥90% pass user spot-check.
- [ ] App ingests tier 3000 smoothly; no performance regressions.
- [ ] Budget tracker on dashboard shows correct cumulative cost.

### Phase 6b (tier 10000)

- [ ] Tier 10000 content generated across multiple Azure free-tier months if needed; cumulative cost ≤ $45.
- [ ] Manual review of 200 random tier-10000 entries: ≥85% pass (relaxed; long tail is noisier).
- [ ] Session queue builds in <200 ms at full scale.
- [ ] Browse page handles 10000 entries smoothly.
- [ ] Audio cache eviction works; no quota errors.

---

## 6. Risks / Things to Watch

- **Long-tail word quality**: words at rank 5000–10000 include obscure forms, technical terms, and corpus artifacts. Accept that not all will get perfect images or translations. The user has accepted that quality may degrade with rank.
- **Cost drift**: fal.ai or Azure pricing could change. Build the cost tracker so the agent updates `costs.json` from manifests at every run.
- **Polish translation drift**: Claude's translations at rank 5000+ may miss nuance for technical or archaic words. Include manual review.
- **Audio voices**: Azure may deprecate `RaquelNeural` or `DuarteNeural` in the future. Plan B: switch to alternative pt-PT voices (Azure has several). All audio file paths are versioned by voice name, so adding a new voice doesn't break existing cards.
- **R2 storage costs**: at 10000 words × 4 audio files × 40 KB = 1.6 GB. Within R2 free tier (10 GB). But monitor.

---

## 7. Definition of Done

The user has access to all 10000 most-frequent European Portuguese words plus curated phrases, with images and audio, scheduled by FSRS. Total content cost is under $50. The app is feature-complete and ready for years of daily use.

After Phase 6, no further roadmap is committed. Possible future directions (out of scope for this PRD):
- Cloze-deletion cards from native podcasts/articles
- Grammar drill mini-games
- Speaking sessions with Claude API as conversation partner

But these are v2. Stop here.
