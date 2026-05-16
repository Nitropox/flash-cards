# pt-cards

European Portuguese (pt-PT) vocabulary learning app for a Polish speaker. Image-anchored flashcards with FSRS spaced repetition, browser-only, single-user, local-first (IndexedDB).

## Tech Stack

- **Build:** Vite
- **Framework:** React 18 + TypeScript (strict)
- **Styling:** Tailwind CSS
- **State:** Zustand (persisted to IndexedDB)
- **Storage:** IndexedDB via Dexie.js
- **Spaced repetition:** ts-fsrs
- **Routing:** React Router v6+
- **PWA:** vite-plugin-pwa (Phase 5)
- **Distribution:** Local PWA (installed from `npm run build` + local static serve)
- **Images:** Flux Schnell via fal.ai (build-time)
- **TTS:** Azure Speech Service, voices `pt-PT-RaquelNeural` and `pt-PT-DuarteNeural` (build-time)
- **STT:** Web Speech API (`lang="pt-PT"`, runtime)
- **Translation:** Claude Code in-session (uses Max plan, no API key needed)

## Hard Constraints

- No backend server. Build-time Node.js scripts generate content; app is static SPA + asset bundle + IndexedDB.
- European Portuguese (pt-PT) only, never Brazilian (pt-BR).
- Single user, no auth, no multi-tenancy.
- One-time content generation budget: USD 50.
- Desktop/laptop browser only.
- Do not substitute libraries named in the tech stack without explicit approval.
- Never run a cost-incurring script without printing an estimate and waiting for confirmation.

## Repository Structure

```
pt-cards/
├── apps/web/                     # Vite React app
│   ├── src/
│   │   ├── components/           # UI components
│   │   ├── pages/                # Route-level views
│   │   ├── stores/               # Zustand stores
│   │   ├── lib/                  # db.ts, fsrs.ts, speech.ts, grading.ts, ingest.ts
│   │   ├── data/                 # Bundled per-tier JSON (build output)
│   │   └── main.tsx
│   └── public/
│       ├── images/               # Generated WebP images
│       └── audio/                # Generated MP3s (dev only; R2 in prod)
├── scripts/                      # Node.js build-time pipelines
│   ├── 01-assemble-wordlist.ts
│   ├── 02-translate.ts
│   ├── 03-generate-images.ts
│   ├── 04-generate-audio.ts
│   ├── 05-bundle-data.ts
│   └── lib/
├── data/
│   ├── sources/                  # Raw frequency lists (gitignored)
│   └── manifests/                # Generation manifests (idempotency)
├── docs/                         # Phase documentation (PRD)
└── CLAUDE.md
```

## Phases

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Working SPA with FSRS, 10 hardcoded words, self-rate mode | Not started |
| 2 | Content pipelines (images, audio, translations), tier 1+100 live | Not started |
| 3 | Tiers 300/500/1000, browse & detail pages, onboarding | Not started |
| 4 | Typed + spoken answer modes | Not started |
| 5 | Stats page, PWA, polish | Not started |
| 6 | Tiers 3000 and 10000, on-demand generation | Not started |

## Development Rules

- Plan before coding. Start each phase with a brief implementation plan and wait for confirmation.
- Idempotency is sacred. All build-time scripts must be safely re-runnable.
- Don't gold-plate. Stick to the PRD for each phase.
- Pause at phase boundaries. Stop at acceptance criteria, report status, wait for go-ahead.
- Each phase is independently deployable.

## Key Data Model Notes

- A single WordEntry produces two Cards (one per direction: `pt_to_pl`, `pl_to_pt`).
- Card ID format: `${wordId}:${direction}`
- Day boundary is 04:00 local time (late-night sessions count as previous day).
- Tier progression is manual (user clicks "Advance" in settings).
- FSRS ratings: 1=Again, 2=Hard, 3=Good, 4=Easy.

## Environment Variables (build-time scripts only, never in client bundle)

```
FAL_API_KEY          # fal.ai image generation
AZURE_SPEECH_KEY     # Azure Speech Service TTS
AZURE_SPEECH_REGION  # e.g. westeurope
```
