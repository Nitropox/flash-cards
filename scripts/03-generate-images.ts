import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const ROOT = join(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'data/assembled');
const MANIFESTS_DIR = join(ROOT, 'data/manifests');
const IMAGES_DIR = join(ROOT, 'apps/web/public/images');
const REVIEW_DIR = join(ROOT, 'scripts/output');

type Entry = {
  id: string;
  pt: string;
  pl: string;
  tier: number;
  imageStrategy: 'literal' | 'scene' | 'none';
  enHint?: string;
  examplePt?: string;
};

type ImageManifest = Record<string, {
  promptHash: string;
  file: string;
  generatedAt: string;
  costUsd: number;
}>;

const COST_PER_IMAGE = 0.003;

function buildPrompt(entry: Entry): string {
  const hint = entry.enHint || entry.pt;
  if (entry.imageStrategy === 'literal') {
    return `flat illustration, single subject: ${hint}, centered, soft pastel colors, minimalist, plain off-white background, absolutely no text, no words, no letters, no writing, no typography, no labels, no border, vector style, even lighting, no shadows`;
  }
  const desc = entry.examplePt ? entry.examplePt.slice(0, 60) : hint;
  return `flat illustration, minimal scene depicting "${hint}" (${desc}), one human figure (silhouette), soft pastel colors, minimalist, plain off-white background, absolutely no text, no words, no letters, no writing, no typography, no labels, no border, vector style, even lighting`;
}

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

async function generateImage(_entry: Entry, prompt: string): Promise<Buffer> {
  const { fal } = await import('@fal-ai/client');
  fal.config({ credentials: process.env['FAL_API_KEY']! });

  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: 'square',
      num_inference_steps: 4,
      enable_safety_checker: false,
    },
  }) as { data: { images: { url: string }[] } };

  const imageUrl = result.data.images[0]!.url;
  const response = await fetch(imageUrl);
  return Buffer.from(await response.arrayBuffer());
}

async function processImage(pngBuffer: Buffer, wordId: string): Promise<string> {
  const sharp = (await import('sharp')).default;
  const outFile = `${wordId}.webp`;
  const outPath = join(IMAGES_DIR, outFile);

  let img = sharp(pngBuffer).resize(512, 512).webp({ quality: 80, effort: 4 });
  let buf = await img.toBuffer();

  if (buf.length > 80 * 1024) {
    img = sharp(pngBuffer).resize(512, 512).webp({ quality: 70, effort: 4 });
    buf = await img.toBuffer();
  }

  writeFileSync(outPath, buf);
  return outFile;
}

function generateReviewHtml(manifest: ImageManifest, entries: Entry[]) {
  const entryMap = new Map(entries.map(e => [e.id, e]));
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Image Review</title>
<style>body{font-family:system-ui;max-width:1200px;margin:0 auto;padding:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.card{border:1px solid #ddd;border-radius:8px;padding:8px;text-align:center}
.card img{width:100%;border-radius:4px}
.card h3{font-size:14px;margin:8px 0 4px}
.card p{font-size:12px;color:#666;margin:0}</style></head><body>
<h1>Image Review (${Object.keys(manifest).length} images)</h1><div class="grid">`;

  for (const [id, info] of Object.entries(manifest)) {
    const entry = entryMap.get(id);
    html += `<div class="card"><img src="../../apps/web/public/images/${info.file}" />
<h3>${entry?.pt || id}</h3><p>${entry?.pl || ''}</p></div>`;
  }

  html += '</div></body></html>';
  if (!existsSync(REVIEW_DIR)) mkdirSync(REVIEW_DIR, { recursive: true });
  writeFileSync(join(REVIEW_DIR, 'images-review.html'), html);
}

async function main() {
  const { values } = parseArgs({
    options: {
      tier: { type: 'string', default: '100' },
      'max-cost-usd': { type: 'string', default: '40' },
      'max-images': { type: 'string', default: '10000' },
      'dry-run': { type: 'boolean', default: false },
      regen: { type: 'string' },
    },
  });

  const maxTier = parseInt(values['tier']!, 10);
  const maxCost = parseFloat(values['max-cost-usd']!);
  const maxImages = parseInt(values['max-images']!, 10);
  const dryRun = values['dry-run']!;
  const regenId = values['regen'];

  if (!process.env['FAL_API_KEY'] && !dryRun) {
    console.error('Error: FAL_API_KEY not set. Use --dry-run to see the plan.');
    process.exit(1);
  }

  const translatedPath = join(DATA_DIR, 'words-translated.json');
  const entries = JSON.parse(readFileSync(translatedPath, 'utf-8')) as Entry[];

  if (!existsSync(MANIFESTS_DIR)) mkdirSync(MANIFESTS_DIR, { recursive: true });
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });

  const manifestPath = join(MANIFESTS_DIR, 'images.json');
  const manifest: ImageManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf-8'))
    : {};

  const eligible = entries.filter(e => {
    if (e.imageStrategy === 'none') return false;
    if (e.tier > maxTier) return false;
    if (regenId) return e.id === regenId;
    const prompt = buildPrompt(e);
    const hash = hashPrompt(prompt);
    if (manifest[e.id] && manifest[e.id].promptHash === hash) return false;
    return true;
  });

  console.log(`\n=== Image Generation ===`);
  console.log(`Tier: ≤${maxTier}`);
  console.log(`Eligible: ${eligible.length} images`);
  console.log(`Estimated cost: $${(eligible.length * COST_PER_IMAGE).toFixed(3)}`);
  console.log(`Max budget: $${maxCost}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would generate:');
    for (const e of eligible.slice(0, 20)) {
      console.log(`  ${e.id} (${e.imageStrategy}): ${e.enHint || e.pt}`);
    }
    if (eligible.length > 20) console.log(`  ... and ${eligible.length - 20} more`);
    return;
  }

  let generated = 0;
  let totalCost = 0;

  for (const entry of eligible) {
    if (generated >= maxImages) {
      console.log(`\nReached max-images limit (${maxImages}).`);
      break;
    }
    if (totalCost + COST_PER_IMAGE > maxCost) {
      console.log(`\nWould exceed max budget ($${maxCost}). Stopping.`);
      break;
    }

    const prompt = buildPrompt(entry);
    const hash = hashPrompt(prompt);

    try {
      console.log(`[${generated + 1}/${eligible.length}] ${entry.id} ...`);
      const pngBuffer = await generateImage(entry, prompt);
      const file = await processImage(pngBuffer, entry.id);

      manifest[entry.id] = {
        promptHash: hash,
        file,
        generatedAt: new Date().toISOString(),
        costUsd: COST_PER_IMAGE,
      };

      generated++;
      totalCost += COST_PER_IMAGE;

      if (generated % 50 === 0) {
        console.log(`  --- Progress: ${generated} images, $${totalCost.toFixed(3)} spent ---`);
      }

      // Throttle: max 5 req/s
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`  ERROR generating ${entry.id}:`, err);
    }

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  generateReviewHtml(manifest, entries);

  console.log(`\n=== Done ===`);
  console.log(`Generated: ${generated} images`);
  console.log(`Total cost this run: $${totalCost.toFixed(3)}`);
  console.log(`Review: scripts/output/images-review.html`);
}

main().catch(console.error);
