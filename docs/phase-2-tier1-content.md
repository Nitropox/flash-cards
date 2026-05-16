# Phase 2 — Content Pipelines & Tier 1 + 100

> **Prerequisites:** Phase 1 complete. Read `00-overview.md`.

## Goal

Build the four Node.js scripts that generate content (word list, translations, images, audio), and run them for tiers 1 and 100. After this phase, the app has 100 real words with real images and real audio, and audio plays in the session player.

---

## 1. Word List Assembly (`scripts/01-assemble-wordlist.ts`)

### 1.1 Sources

Acquire and place under `data/sources/`:

1. **Hacking Portuguese top 1000 nouns** + **top 1000 verbs** (HTML pages or scraped JSON). These are derived from Corpus do Português and include both pt-PT and pt-BR uses.
2. **Wiktionary pt-PT OpenSubtitles frequency list** (5000 words, plain text). Used as the **canonical European usage filter**: if a word doesn't appear here, it's probably Brazilian.
3. **PortuguesePod101 / 101languages.net top 100** — sanity check for beginner relevance.
4. **A Frequency Dictionary of Portuguese** (Davies & Preto-Bay). Copyrighted — the user must source legitimately. Use only the (word, PoS, gender, example sentence) tuples; do not redistribute raw dictionary content.

### 1.2 Output

Emit `data/assembled/words-raw.json` — a deduplicated, ranked list of entries with everything we know from sources except translations:

```ts
type RawEntry = {
  id: string;                  // slugified pt form, suffix -1/-2 for sense disambiguation
  type: "word" | "phrase";
  pt: string;
  partOfSpeech: WordEntry["partOfSpeech"];
  gender?: "m" | "f" | "mf";
  pluralPt?: string;
  conjugationHint?: string;
  examplePt: string | null;    // null if no source provided one — Phase 02b generates
  frequencyRank: number;
  tier: WordEntry["tier"];
  inEuropeanList: boolean;     // true if appears in Wiktionary pt-PT list
  rawNotes?: string;
};
```

### 1.3 Phrase ingestion

Augment the raw list with a manually curated `data/sources/phrases-pt.json` of ~150–300 high-utility European Portuguese phrases (`type: "phrase"`). Examples: *estar com fome*, *ter saudade*, *dar uma volta*, *fazer anos*, *pois é*, *está bem*, *bom proveito*, *de nada*, *com certeza*, *se calhar*. Each entry has its own `frequencyRank` assigned based on perceived utility; place them in tiers 100, 300, 500, or 1000 accordingly.

The agent should generate this `phrases-pt.json` once, programmatically (use Claude API to propose phrases, then dump to JSON) — **but require user review** before continuing. Output a TODO file listing them for the user to skim and accept/reject in one batch.

### 1.4 Tier assignment

For ranked entries:
- Rank 1–10 → tier 10 (override with hand-curated set from Phase 1)
- 11–100 → tier 100
- 101–300 → tier 300
- 301–500 → tier 500
- 501–1000 → tier 1000
- 1001–3000 → tier 3000
- 3001–10000 → tier 10000

### 1.5 European-Portuguese filter

If a word appears in source lists but **not** in the Wiktionary pt-PT list, and is in the top 3000, log a warning. Common BR-specific words to demote or replace:
- `ônibus` → `autocarro`
- `trem` → `comboio`
- `celular` → `telemóvel`
- `geladeira` → `frigorífico`
- `xícara` → `chávena`
- `sorvete` → `gelado`
- `legal` (as in "cool") → `fixe`
- `garoto/menino` → `rapaz/miúdo`
- `bonde` → `eléctrico`
- `aquarela` → `aguarela`

Maintain `scripts/lib/pt-br-substitutions.ts` with this mapping and apply at assembly time. For tier ≤1000, prefer the European form even if its frequency rank is technically lower.

---

## 2. Image Generation (`scripts/03-generate-images.ts`)

> Note: numbered 03 not 02 to match `00-overview.md`. Run order: 01 → 02 (translate) → 03 (images) → 04 (audio) → 05 (bundle).

### 3.1 imageStrategy classification

Before generation, classify each entry into one of:

| Strategy | Applies to | Image generated? |
|---|---|---|
| `literal` | Concrete nouns and simple objects (casa, cão, maçã, mesa, livro) | Yes — single object |
| `scene` | Verbs, adjectives, phrases, abstract nouns (correr, feliz, *estar com fome*, saudade, tempo) | Yes — minimal scene |
| `none` | Function words and pure grammar (de, que, e, a, o, em, para, com, mas, se, ou, …) | **No image.** Card shows the word large with the example sentence |

Classification approach: send batches of 50 entries `(pt, pl, partOfSpeech, examplePt)` to Claude API. Prompt the model to return one of `"literal" | "scene" | "none"` per entry with a one-line justification. Validate output is strictly one of three values.

The user has accepted that images for highly abstract words (*saudade*, *alma*, *fé*) may be weak; if the model is unsure, prefer `scene` over `none`. The example sentence is always available as backup.

### 3.2 Provider

**fal.ai** with `fal-ai/flux/schnell`. Use `@fal-ai/serverless-client` npm package.

```ts
import { fal } from "@fal-ai/serverless-client";
fal.config({ credentials: process.env.FAL_API_KEY });

const result = await fal.subscribe("fal-ai/flux/schnell", {
  input: {
    prompt: buildPrompt(entry),
    image_size: "square",        // 1024x1024
    num_inference_steps: 4,
    enable_safety_checker: false, // we control the prompts
  },
});
```

Cost ≈ USD 0.003/image. 1024×1024 PNG output.

### 3.3 Prompt templates

For `literal`:

```
flat illustration, single subject: {EN_TRANSLATION}, centered, soft pastel colors, minimalist, plain off-white background, no text, no letters, no border, vector style, even lighting, no shadows
```

For `scene`:

```
flat illustration, minimal scene depicting "{EN_TRANSLATION}" ({SHORT_DESCRIPTION}), one human figure (silhouette), soft pastel colors, minimalist, plain off-white background, no text, no letters, no border, vector style, even lighting
```

`EN_TRANSLATION` is the English gloss — translate `pt` → English once during ingestion via Claude API (not Polish; English prompts produce much better results from Flux). Store as `entry.enHint` for reuse.

`SHORT_DESCRIPTION` is a 5–10-word disambiguating phrase from the example sentence (e.g. for *estar com fome* → "a person looking hungry and waiting for food").

### 3.4 Idempotency

Maintain `data/manifests/images.json`:

```ts
type ImageManifest = {
  [wordId: string]: {
    promptHash: string;
    file: string;            // e.g. "casa-1.webp"
    generatedAt: string;     // ISO
    costUsd: number;
  };
};
```

On rerun: skip entry if `promptHash` matches and file exists. Otherwise regenerate.

### 3.5 Post-processing

After download:
1. Convert PNG → WebP via `sharp` (quality 80, effort 4).
2. Resize to 512×512 (the UI displays at 256–320 max).
3. Target ≤80 KB per file. If larger, drop quality to 70 and retry.
4. Save to `apps/web/public/images/{wordId}.webp`.

### 3.6 Budget cap & flags

Script flags:
```
--tier <10|100|300|500|1000|3000|10000>   process only entries with this tier (cumulative: --tier 100 → tiers 10 and 100)
--max-cost-usd <number>                    abort if cumulative cost would exceed (default: 40)
--max-images <number>                      abort after N images (safety net)
--dry-run                                  print plan without calling API
--regen <wordId>                           force regeneration of one entry
```

Print running cost estimate every 50 generations. Default run for Phase 2: `--tier 100` (≈ 70 images with strategy ≠ none ≈ $0.21).

### 3.7 Quality review

After each run, emit `scripts/output/images-review.html` — a static grid of all generated images with their `pt`, `pl`, and prompt visible. User opens locally and flags bad ones. Re-run with `--regen` for flagged entries.

---

## 3. Translation Pipeline (Claude Code in-session)

### 3.1 Strategy

Claude Code translates entries in-session (no API key needed), writing results to `data/assembled/words-translated.json` directly. Work in batches of 50 entries.

For each `RawEntry` without `pl`, Claude Code produces:

- `pl`: the most common Polish translation (one word or short phrase, no parenthetical alternatives)
- `examplePt`: the provided example sentence verified to be pt-PT (substitute any pt-BR vocabulary)
- `examplePl`: Polish translation of examplePt
- `enHint`: an English gloss (1-3 words) used internally for image prompts
- `imageStrategy`: `"literal" | "scene" | "none"` (see definitions in §2)
- `notes`: any pt-PT-specific grammar quirk or sense disambiguation (one sentence max), or null

Strict requirements:
- `pl` is Polish ONLY, no Portuguese in parentheses
- For verbs, `pl` is in infinitive form
- For nouns, `pl` is in nominative singular
- If pt has multiple senses, this entry already represents one sense (id suffix indicates which); pick translation matching the example
- `examplePt` must be European Portuguese — replace any Brazilian-only vocabulary

After every 50 entries, show the user a sample for style review before continuing.

### 3.2 Example sentence generation

If `examplePt` is null (no source provided one), generate it in the same batch:
- ≤12 words
- A1–B1 level for tier ≤1000, B2 for higher
- Clearly demonstrates the word's meaning
- pt-PT vocabulary only

### 3.3 Validation

After producing translations, validate:
- All required fields present
- `pl` is not empty and doesn't contain Portuguese characters (no `ã ç õ á é í ó ú`)
- `examplePt` includes the target word (or a conjugation of it for verbs)
- `imageStrategy` is one of three allowed values

Failed entries → write to `data/output/translation-errors.json` for manual fix. Don't block the batch.

### 3.4 Output

Emit `data/assembled/words-translated.json` — full `WordEntry` shape minus audio/image paths (which come from later scripts).

---

## 4. Audio Generation (`scripts/04-generate-audio.ts`)

### 4.1 Provider

**Azure Cognitive Services Speech**, REST API. Free tier: 0.5 M neural characters/month for first 12 months, then 500K free-tier voices.

For full 10000 entries × 2 voices × 2 texts (word + example) at avg 8 chars for word and 50 chars for example → ~2.3 M characters total — exceeds monthly free tier. **Solution:** generate progressively (tier by tier, spread over months), or pay-as-you-go ($16/1M chars for neural).

For Phase 2, only tier 1 + 100 = ~100 entries × ~120 chars × 2 voices ≈ 24 K chars. Free.

### 4.2 Voices

- `pt-PT-RaquelNeural` (female, default)
- `pt-PT-DuarteNeural` (male, alternate)

Generate **both** for every entry so user can switch in settings without regenerating.

### 4.3 SSML

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

### 4.4 Output

MP3 16 kHz mono, ~32 kbps. Files at `apps/web/public/audio/{voice}/{wordId}/word.mp3` and `.../example.mp3`.

### 4.5 Idempotency

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

### 4.6 Flags

```
--tier <N>
--voice <Raquel|Duarte|both>     default: both
--regen <wordId>
--dry-run
--max-chars <number>             safety cap, default 100000 per run
```

---

## 5. Bundle Script (`scripts/05-bundle-data.ts`)

Combines `data/assembled/words-translated.json` with `data/manifests/{images,audio}.json` into the final per-tier JSON files the app consumes:

```
apps/web/src/data/
├── tier-10.json
├── tier-100.json
├── tier-300.json
├── tier-500.json
├── tier-1000.json
├── tier-3000.json
└── tier-10000.json
```

Each file contains only entries with that tier value. The app loads them lazily (see Phase 3 for lazy-loading logic; for Phase 2 we load tier-10 and tier-100 eagerly).

---

## 6. App Integration

### 6.1 Update seed/ingest logic

`src/lib/ingest.ts`:
- On first run, ingest `tier-10.json` into `words` and create cards.
- After user advances tier (or in Phase 2, automatically), ingest the new tier's JSON.
- Detect already-ingested words by `id` — never duplicate.

### 6.2 Audio playback in session

In `CardView.tsx`, when card flips to back:
- Read `Settings.ttsVoice` and `Settings.ttsAutoPlay`.
- If autoPlay, immediately play `/audio/${voice.toLowerCase()}/${wordId}/word.mp3`.
- Speaker button (icon: 🔊) replays the word audio.
- Second speaker button (with example icon) plays `example.mp3`.
- Keyboard: `P` replays word, `Shift+P` replays example.

Handle audio errors gracefully (file missing → toast "Audio not yet available for this word").

### 6.3 Image rendering

In `CardView.tsx`:
- If `imageStrategy === "none"`, render the word itself huge (text-6xl) in place of an image with a subtle decoration.
- Otherwise render `<img src={imageFile} />` with explicit width/height to avoid layout shift.
- All images lazy-loaded (`loading="lazy"`).

---

## 7. Acceptance Criteria

- [ ] All four scripts (01, 02, 03, 04) run from `npm run data:*` and are idempotent.
- [ ] Manifests in `data/manifests/` are valid JSON and survive re-runs without duplication.
- [ ] `data:bundle` produces `tier-10.json` and `tier-100.json` with ≥100 valid entries combined.
- [ ] Every entry has either a valid `imageFile` or `imageStrategy === "none"`.
- [ ] Every entry has `audioPt` and `audioExamplePt` pointing to files that exist in `public/audio/`.
- [ ] Total Phase 2 generation cost recorded ≤ USD 5 (target ≤ $1 for tier 100).
- [ ] App ingests tier 1 + 100 cards on first load.
- [ ] Audio plays correctly in session player for both voices.
- [ ] Images render correctly; function words show large text instead.
- [ ] At least 80% of tier-100 entries pass user spot-check (image clearly represents word, audio sounds correct).

---

## 8. Risks / Things to Watch

- **Sense ambiguity** (banco = bank/bench, vela = sail/candle). Translation script must emit suffixed IDs (`banco-1`, `banco-2`) when both senses are common. Use Claude to detect.
- **Phrase image quality**: Flux Schnell can struggle with multi-element scenes. If results are poor for a phrase, set `imageStrategy = "none"` for that entry.
- **Rate limits**: fal.ai is forgiving; Azure has region-specific limits. Throttle to 5 req/s for both.
- **PT spelling variants**: pt-PT accepted both pre-1990 and post-1990 spellings (e.g. *acção* vs *ação*, *facto* vs *fato*). Use post-1990 (current standard). If a source has old spelling, normalize.
- **Audio file size**: at full scale (10000 words), `public/audio/` can grow large. Consider `.gitignore`ing it and regenerating from manifests.

---

## 9. Definition of Done

Tier 10 + 100 = 100 words and phrases are fully populated with translations, images (where applicable), and audio in both voices. App locally plays audio and shows images during sessions. Cost stays well under $5. Stop here, await user approval, before moving to Phase 3.
