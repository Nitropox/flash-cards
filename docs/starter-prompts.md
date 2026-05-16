# Starter Prompts for Claude Code

> **How to use:** Open Claude Code in your project directory. Copy the entire prompt for the phase you're starting. Make sure the referenced `.md` files are in the project directory before you paste.

---

## Before Phase 1 — One-time setup

Drop these files into the root of a fresh directory where you want the project to live:

- `00-overview.md`
- `phase-1-skeleton.md` ... `phase-6-higher-tiers.md`
- This file (`starter-prompts.md`)

Initialize a git repo. Don't run `npm create vite` yet — Claude Code will do that as part of Phase 1.

---

## Phase 1 — Skeleton

```
Read `00-overview.md` (shared context for the whole project) and then `phase-1-skeleton.md` (this phase). Implement Phase 1 end-to-end as specified.

Important constraints:
- Use exactly the tech stack named in 00-overview.md §3. Do not substitute libraries.
- Do not start any work from later phases. If something feels missing, it probably belongs in Phase 2+.
- Use the exact 10 hardcoded entries from phase-1-skeleton.md §5. Don't add or modify them.
- For audio and image paths in those entries, just emit them as-is even though no files exist yet — the app should gracefully render a placeholder when files are missing.

Plan first, then implement. Pause for my review before deploying to Vercel — I want to walk through the code locally first.

When you're done, run through the acceptance criteria in phase-1-skeleton.md §10 and report which boxes are checked.
```

---

## Phase 2 — Content pipelines (tier 1 + 100)

```
Read `00-overview.md` and `phase-2-tier1-content.md`. Phase 1 is complete and deployed; you can see the current state of the repo.

Implement Phase 2 in this order:
1. Cloudflare R2 setup — I'll provide credentials in .env.local.
2. Script 01 (assemble-wordlist) — get it working with sources I'll point you to.
3. Script 02 (translate) — wire to Anthropic API.
4. Script 03 (generate-images) — wire to fal.ai. STOP after running with `--tier 10` so I can review the first images before generating tier 100.
5. Script 04 (generate-audio) — wire to Azure Speech.
6. Script 05 (bundle-data).
7. App integration (audio playback, image rendering with `imageStrategy === "none"` handling).

For the tier-10 hand-curated set from Phase 1, generate proper images and audio so those 10 cards become "real". Then generate tier-100 fresh.

Część pracy z fazy 2 to tłumaczenia polskie i klasyfikacja imageStrategy. Nie używaj Anthropic API do tego (nie mam klucza). Zamiast tego rób tłumaczenia jako agentic task wewnątrz tej sesji Claude Code - batchami po 50 słów, zapisując wynik do JSON. Pokazuj mi co 50 słów próbkę, żebym mógł poprawić styl jeśli trzeba.

Before each script run that costs money, print the cost estimate and ask me to confirm. Show running totals.

After implementing, run through acceptance criteria in phase-2-tier1-content.md §7.
```

---

## Phase 3 — Tier expansion + Browse/Detail

```
Read `00-overview.md` and `phase-3-tier-expansion.md`. Phases 1–2 are complete.

Implement Phase 3:
1. Run pipelines to generate content for tiers 300, 500, and 1000. Stage them — confirm tier 300 looks good before generating 500, then 1000.
2. Lazy-load tier JSON; verify in DevTools that each tier is a separate Vite chunk.
3. Build the Browse page with virtualization for 1000+ entries.
4. Build the Word Detail page.
5. Build the first-run onboarding (3-step flow).
6. Build the tier-advance UI in Settings + recommendation banner on Dashboard.

Acceptance criteria in phase-3-tier-expansion.md §7. Report which are met.
```

---

## Phase 4 — Answer modes

```
Read `00-overview.md` and `phase-4-answer-modes.md`. Phases 1–3 are complete.

Implement Phase 4:
1. Mode switcher UI in session player.
2. Typed mode + grading logic with exact / diacritics / typo / wrong tiers.
3. Multiple-acceptable-answers support (parse synonyms from notes).
4. Web Speech API wrapper.
5. Spoken mode integration (pl_to_pt direction only).
6. Updated keyboard shortcuts.
7. ReviewLog augmentation.

No new content needs to be generated this phase. Focus on the UX.

Acceptance criteria in phase-4-answer-modes.md §6.
```

---

## Phase 5 — Stats and PWA

```
Read `00-overview.md` and `phase-5-stats-polish.md`. Phases 1–4 are complete.

Implement Phase 5:
1. Stats page with all four metric cards and four charts (use recharts).
2. Export / import JSON.
3. PWA via vite-plugin-pwa; install icons; service worker for offline.
4. Streak system.
5. Theme refinement (light/dark/system).
6. Recommendation banner polish + rotating tips on dashboard.

Configure Cloudflare R2 CORS to allow GET from the deployed Vercel origin so service worker can cache audio.

After deployment, walk through DevTools "Offline" mode and verify the app works without network after first visit.

Acceptance criteria in phase-5-stats-polish.md §6.
```

---

## Phase 6a — Tier 3000

```
Read `00-overview.md` and `phase-6-higher-tiers.md`. Phases 1–5 are complete and the app has been in real use; I've reached the point in tier 1000 where I'm ready to expand.

Implement Phase 6a:
1. Update Settings: add tier 3000 (locked until tier 1000 is fully ingested).
2. Add budget tracker card on Dashboard.
3. Run scripts for tier 3000. Pause for me to review 100 random samples before committing the bundled JSON.
4. Validate performance: session queue still builds <200 ms with all cards loaded.

Defer tier 10000 (Phase 6b) to a separate run later. Do not generate it yet.

Acceptance criteria for Phase 6a in phase-6-higher-tiers.md §5.
```

---

## Phase 6b — Tier 10000 (much later)

```
Read `00-overview.md` and `phase-6-higher-tiers.md`. Phase 6a is complete; I've spent meaningful time in tier 3000.

Implement Phase 6b: generate tier 10000 content.

Critical: this is the largest run by far. Specifically:
- Spread Azure audio generation across multiple months if needed to stay in the free tier.
- Apply tighter pt-PT filtering at this scale.
- Manual review on 200 random samples before bundling.
- Validate performance at full scale (10000 words, 20000 cards).
- Verify cumulative content cost ≤ $45.

Acceptance criteria for Phase 6b in phase-6-higher-tiers.md §5.
```

---

## General notes for Claude Code

A few rules that apply across all phases:

- **Plan before coding.** For every phase, start with a brief implementation plan (5–15 bullets) and wait for confirmation.
- **Never substitute libraries** named in `00-overview.md §3` without asking.
- **Never run a script that costs money without printing an estimate and waiting for confirmation.**
- **Idempotency is sacred.** All build-time scripts must be safely re-runnable.
- **No backend.** This is a static SPA + IndexedDB. If you find yourself wanting to add an API server, stop and explain why.
- **Don't gold-plate.** Stick to the PRD for each phase. Future-phase work belongs in the future phase.
- **Pause at phase boundaries.** Each phase ends with an acceptance-criteria checklist and a definition of done. Stop there, report status, and wait for go-ahead before starting the next.
