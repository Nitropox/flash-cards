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

const SCENE_DESCRIPTIONS: Record<string, string> = {
  'ola': 'two people waving hands at each other in greeting',
  'obrigado': 'a person bowing slightly with hand on chest showing gratitude',
  'por-favor': 'a person with hands together in polite request gesture',
  'sim': 'a person nodding with a thumbs up',
  'nao': 'a person shaking head with hand up in stop gesture',
  'bom-dia': 'sunrise over rooftops with a person stretching at window',
  'desculpe': 'a person with apologetic posture, hand raised slightly',
  'eu-sou': 'a person pointing at themselves confidently',
  'como-estas': 'two people meeting, one tilting head with questioning gesture',
  'adeus': 'a person waving goodbye walking away',
  'ter': 'a person holding a gift box in both hands',
  'poder': 'a strong person lifting something heavy easily',
  'fazer': 'a person crafting something at a workbench with tools',
  'ir': 'a person walking forward on a path with determination',
  'dizer': 'a person speaking with speech bubble shape (empty, no text)',
  'dar': 'one person handing a wrapped gift to another person',
  'saber': 'a person with a lightbulb appearing above their head',
  'querer': 'a person reaching toward a shining star',
  'ver': 'a person looking through binoculars at a landscape',
  'grande': 'an elephant next to a tiny mouse for scale contrast',
  'coisa': 'a mystery box with question mark shape on it',
  'dia': 'bright sun in blue sky over a green meadow',
  'ano': 'four trees showing four seasons side by side',
  'casa': 'a cozy small house with chimney and garden',
  'tempo': 'a clock face with sun and rain clouds around it',
  'ficar': 'a person sitting comfortably in an armchair at home',
  'homem': 'a man in casual clothes standing confidently',
  'vida': 'a winding path through beautiful nature landscape',
  'vir': 'a person approaching and walking toward the viewer',
  'novo': 'a shiny new car with sparkles around it',
  'trabalho': 'a person at a desk with laptop focused on work',
  'achar': 'a person with finger on chin in thinking pose',
  'falar': 'two people in animated conversation face to face',
  'mulher': 'a woman in casual clothes standing confidently',
  'agua': 'a clear glass of water with droplets on the side',
  'hora': 'a large clock showing the time',
  'comer': 'a person at a table eating a meal with fork and knife',
  'mundo': 'planet earth seen from space with continents visible',
  'pai': 'a father holding a child on his shoulders',
  'amigo': 'two friends walking together arm in arm laughing',
  'precisar': 'a person with empty hands looking at something they need',
  'noite': 'a crescent moon and stars over a sleeping city',
  'olhar': 'a person gazing intently at something in the distance',
  'pensar': 'a person sitting with hand on chin deep in thought',
  'obrigada': 'a woman bowing slightly with hand on chest showing gratitude',
  'hoje': 'a calendar page with today highlighted and sun shining',
  'gostar': 'a person hugging a large heart shape',
  'cidade': 'a city skyline with buildings and a bridge',
  'senhor': 'an older gentleman in a suit tipping his hat',
};

function buildPrompt(entry: Entry): string {
  const noText = 'textless image, no text anywhere, no words, no letters, no writing, no characters, no symbols, no typography, no labels, no captions';
  const style = 'flat vector illustration, soft pastel colors, minimalist, plain off-white background, no border, even lighting';

  const sceneDesc = SCENE_DESCRIPTIONS[entry.id];

  if (entry.imageStrategy === 'literal' && !sceneDesc) {
    const hint = entry.enHint || entry.pt;
    return `${noText}, ${style}, single centered object: a ${hint}, no shadows`;
  }

  const desc = sceneDesc || `a scene related to the concept of ${entry.enHint || entry.pt}`;
  return `${noText}, ${style}, ${desc}`;
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
