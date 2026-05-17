import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const ROOT = join(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'data/assembled');
const MANIFESTS_DIR = join(ROOT, 'data/manifests');
const AUDIO_DIR = join(ROOT, 'apps/web/public/audio');

type Entry = {
  id: string;
  pt: string;
  examplePt: string;
  tier: number;
};

type AudioManifest = Record<string, {
  textHash: string;
  file: string;
  generatedAt: string;
  charCount: number;
}>;

const VOICES = ['raquel', 'duarte'] as const;
const VOICE_NAMES: Record<string, string> = {
  raquel: 'pt-PT-RaquelNeural',
  duarte: 'pt-PT-DuarteNeural',
};

function buildSSML(voiceName: string, text: string, slow: boolean): string {
  const content = slow
    ? `<prosody rate="-10%">${text}</prosody>`
    : text;
  return `<speak version="1.0" xml:lang="pt-PT"><voice name="${voiceName}">${content}</voice></speak>`;
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function synthesize(ssml: string): Promise<Buffer> {
  const key = process.env['AZURE_SPEECH_KEY'];
  const region = process.env['AZURE_SPEECH_REGION'];
  if (!key || !region) throw new Error('AZURE_SPEECH_KEY or AZURE_SPEECH_REGION not set');

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
    },
    body: ssml,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Azure TTS error ${res.status}: ${body}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const { values } = parseArgs({
    options: {
      tier: { type: 'string', default: '100' },
      voice: { type: 'string', default: 'both' },
      regen: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'max-chars': { type: 'string', default: '100000' },
    },
  });

  const maxTier = parseInt(values['tier']!, 10);
  const voiceFilter = values['voice']!;
  const dryRun = values['dry-run']!;
  const maxChars = parseInt(values['max-chars']!, 10);
  const regenId = values['regen'];

  const translatedPath = join(DATA_DIR, 'words-translated.json');
  const entries = JSON.parse(readFileSync(translatedPath, 'utf-8')) as Entry[];

  if (!existsSync(MANIFESTS_DIR)) mkdirSync(MANIFESTS_DIR, { recursive: true });

  const manifestPath = join(MANIFESTS_DIR, 'audio.json');
  const manifest: AudioManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf-8'))
    : {};

  const voices = voiceFilter === 'both' ? [...VOICES] : [voiceFilter as typeof VOICES[number]];
  const eligible: { entry: Entry; voice: string; kind: 'word' | 'example'; text: string; key: string }[] = [];

  for (const entry of entries) {
    if (entry.tier > maxTier) continue;
    if (regenId && entry.id !== regenId) continue;

    for (const voice of voices) {
      const wordKey = `${voice}/${entry.id}/word`;
      const exampleKey = `${voice}/${entry.id}/example`;
      const wordHash = hashText(entry.pt);
      const exampleHash = hashText(entry.examplePt);

      if (!manifest[wordKey] || manifest[wordKey].textHash !== wordHash || regenId) {
        eligible.push({ entry, voice, kind: 'word', text: entry.pt, key: wordKey });
      }
      if (!manifest[exampleKey] || manifest[exampleKey].textHash !== exampleHash || regenId) {
        eligible.push({ entry, voice, kind: 'example', text: entry.examplePt, key: exampleKey });
      }
    }
  }

  const totalChars = eligible.reduce((sum, e) => sum + e.text.length, 0);

  console.log(`\n=== Audio Generation ===`);
  console.log(`Tier: ≤${maxTier}`);
  console.log(`Voices: ${voices.join(', ')}`);
  console.log(`Eligible: ${eligible.length} files`);
  console.log(`Total chars: ${totalChars.toLocaleString()}`);
  console.log(`Max chars: ${maxChars.toLocaleString()}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would generate:');
    const sample = eligible.slice(0, 20);
    for (const e of sample) {
      console.log(`  ${e.key}: "${e.text.slice(0, 40)}..." (${e.text.length} chars)`);
    }
    if (eligible.length > 20) console.log(`  ... and ${eligible.length - 20} more`);
    console.log(`\nTotal chars this run: ${totalChars.toLocaleString()}`);
    return;
  }

  if (!process.env['AZURE_SPEECH_KEY'] || !process.env['AZURE_SPEECH_REGION']) {
    console.error('Error: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set.');
    process.exit(1);
  }

  if (totalChars > maxChars) {
    console.log(`\nWould exceed max-chars (${totalChars} > ${maxChars}). Processing first ${maxChars} chars worth.`);
  }

  let generated = 0;
  let charsUsed = 0;

  for (const item of eligible) {
    if (charsUsed + item.text.length > maxChars) {
      console.log(`\nReached max-chars limit (${charsUsed}/${maxChars}). Stopping.`);
      break;
    }

    const voiceName = VOICE_NAMES[item.voice]!;
    const ssml = buildSSML(voiceName, item.text, item.kind === 'word');

    const dir = join(AUDIO_DIR, item.voice, item.entry.id);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const filePath = join(dir, `${item.kind}.mp3`);
    const relativePath = `audio/${item.voice}/${item.entry.id}/${item.kind}.mp3`;

    try {
      const mp3 = await synthesize(ssml);
      writeFileSync(filePath, mp3);

      manifest[item.key] = {
        textHash: hashText(item.text),
        file: relativePath,
        generatedAt: new Date().toISOString(),
        charCount: item.text.length,
      };

      generated++;
      charsUsed += item.text.length;

      if (generated % 100 === 0) {
        console.log(`  [${generated}/${eligible.length}] ${charsUsed.toLocaleString()} chars used`);
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }

      // Rate limit: ~5 req/s
      await sleep(200);
    } catch (err) {
      console.error(`  ERROR ${item.key}:`, err);
      await sleep(1000);
    }
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const totalManifestChars = Object.values(manifest).reduce((sum, e) => sum + e.charCount, 0);

  console.log(`\n=== Done ===`);
  console.log(`Generated: ${generated} files`);
  console.log(`Chars this run: ${charsUsed.toLocaleString()}`);
  console.log(`Total chars in manifest: ${totalManifestChars.toLocaleString()}`);
}

main().catch(console.error);
