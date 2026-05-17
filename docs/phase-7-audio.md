# Phase 7 — Audio Generation (Azure TTS)

> **Prerequisites:** Phases 1–6 complete (all tiers have translations and images). Read `00-overview.md`.

## Goal

Generate TTS audio for all words and phrases across all tiers using Azure Speech Service. After this phase, the app has full audio playback for every card.

---

## 1. Provider

**Azure Cognitive Services Speech**, REST API. Free tier: 0.5 M neural characters/month for first 12 months, then 500K free-tier voices.

For full 10000 entries × 2 voices × 2 texts (word + example) at avg 8 chars for word and 50 chars for example → ~2.3 M characters total — exceeds monthly free tier. **Solution:** generate progressively (tier by tier, spread over months), or pay-as-you-go ($16/1M chars for neural).

---

## 2. Voices

- `pt-PT-RaquelNeural` (female, default)
- `pt-PT-DuarteNeural` (male, alternate)

Generate **both** for every entry so user can switch in settings without regenerating.

---

## 3. SSML

```xml
<speak version="1.0" xml:lang="pt-PT">
  <voice name="pt-PT-RaquelNeural">
    <prosody rate="-10%">
      {WORD_OR_PHRASE}
    </prosody>
  </voice>
</speak>
```

For example sentences, use normal rate (no `<prosody>`).

---

## 4. Output

MP3 16 kHz mono, ~32 kbps. Files at `apps/web/public/audio/{voice}/{wordId}/word.mp3` and `.../example.mp3`.

---

## 5. Script (`scripts/04-generate-audio.ts`)

### 5.1 Idempotency

Manifest at `data/manifests/audio.json`:

```ts
type AudioManifest = {
  [key: string]: {            // key = `{voice}/{wordId}/{kind}`
    textHash: string;
    file: string;
    generatedAt: string;
    charCount: number;
  };
};
```

Skip on rerun if textHash matches.

### 5.2 Flags

```
--tier <N>                           cumulative: --tier 100 → tiers 10 and 100
--voice <Raquel|Duarte|both>         default: both
--regen <wordId>                     force regeneration of one entry
--dry-run                            print plan without calling API
--max-chars <number>                 safety cap, default 100000 per run
```

### 5.3 Rate limiting

Azure has region-specific limits. Throttle to 5 req/s. Use 4 concurrent requests max.

### 5.4 Progressive generation strategy

To stay within Azure free tier (500K chars/month):

| Tier | Entries | Chars (both voices, word + example) | Months needed (free tier) |
|---|---|---|---|
| 10 + 100 | 100 | ~24K | 1 (instant) |
| 300 + 500 | 400 | ~100K | 1 |
| 1000 | 500 | ~125K | 1 |
| 3000 | 2000 | ~500K | 1 |
| 10000 | 7000 | ~1.75M | 4 |

Recommended approach: generate tier by tier across months. The `--max-chars` flag prevents accidentally burning through the free tier in one run.

---

## 6. App Integration

After audio files are generated and `data:bundle` is re-run:
- Entries in tier JSON will have valid `audioPt` and `audioExamplePt` paths.
- The audio playback UI (already wired in Phase 2) will find the files and play them.
- Rebuild the PWA (`npm run build` + reinstall) to include new audio in the service worker cache.

---

## 7. Acceptance Criteria

- [ ] Script `04-generate-audio` runs from `npm run data:audio` and is idempotent.
- [ ] Manifest at `data/manifests/audio.json` is valid and survives re-runs without duplication.
- [ ] Audio plays correctly in session player for both voices.
- [ ] `--dry-run` prints char count estimate without calling Azure.
- [ ] `--max-chars` aborts before exceeding the cap.
- [ ] At least tier 10 + 100 audio generated and verified: pronunciation is correct pt-PT.
- [ ] App gracefully handles partial audio (some tiers generated, others not yet).

---

## 8. Risks / Things to Watch

- **Azure free tier exhaustion**: track monthly char usage via the manifest. Print cumulative chars at end of each run.
- **Voice deprecation**: Azure may deprecate `RaquelNeural` or `DuarteNeural`. Plan B: switch to alternative pt-PT voices. Audio paths are versioned by voice name, so adding a new voice doesn't break existing cards.
- **Disk size**: at full scale, `public/audio/` is ~1.6 GB. Already `.gitignore`d — regenerate from manifests on new machines.
- **Rate limits**: Azure region-specific. If hitting 429s, reduce concurrency or switch region.

---

## 9. Definition of Done

All tiers have audio generated for both voices. The app plays word and example audio for every card. Progressive generation keeps costs within Azure free tier where possible. Total audio cost ≤ $10.
