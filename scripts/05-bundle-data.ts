import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'data/assembled');
const MANIFESTS_DIR = join(ROOT, 'data/manifests');
const OUTPUT_DIR = join(ROOT, 'apps/web/src/data');

type Tier = 10 | 100 | 300 | 500 | 1000 | 3000 | 10000;
const ALL_TIERS: Tier[] = [10, 100, 300, 500, 1000, 3000, 10000];

function main() {
  const translatedPath = join(DATA_DIR, 'words-translated.json');
  if (!existsSync(translatedPath)) {
    console.error('Error: data/assembled/words-translated.json not found');
    process.exit(1);
  }

  const entries = JSON.parse(readFileSync(translatedPath, 'utf-8')) as Record<string, unknown>[];

  const imagesManifestPath = join(MANIFESTS_DIR, 'images.json');
  const imageManifest: Record<string, { file: string }> = existsSync(imagesManifestPath)
    ? JSON.parse(readFileSync(imagesManifestPath, 'utf-8'))
    : {};

  const audioManifestPath = join(MANIFESTS_DIR, 'audio.json');
  const audioManifest: Record<string, { file: string }> = existsSync(audioManifestPath)
    ? JSON.parse(readFileSync(audioManifestPath, 'utf-8'))
    : {};

  for (const entry of entries) {
    const id = entry['id'] as string;

    if (imageManifest[id]) {
      entry['imageFile'] = `images/${imageManifest[id].file}`;
    }

    if (!entry['audioPt']) {
      const voiceKey = `raquel/${id}/word`;
      if (audioManifest[voiceKey]) {
        entry['audioPt'] = `audio/raquel/${id}/word.mp3`;
      }
    }
    if (!entry['audioExamplePt']) {
      const voiceKey = `raquel/${id}/example`;
      if (audioManifest[voiceKey]) {
        entry['audioExamplePt'] = `audio/raquel/${id}/example.mp3`;
      }
    }
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const tier of ALL_TIERS) {
    const tierEntries = entries.filter(e => e['tier'] === tier);
    if (tierEntries.length === 0) continue;

    const outPath = join(OUTPUT_DIR, `tier-${tier}.json`);
    writeFileSync(outPath, JSON.stringify(tierEntries, null, 2));
    console.log(`tier-${tier}.json: ${tierEntries.length} entries`);
  }

  console.log(`\nTotal: ${entries.length} entries bundled.`);
}

main();
