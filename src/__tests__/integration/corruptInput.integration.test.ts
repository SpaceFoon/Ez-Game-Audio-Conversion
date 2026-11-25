/**
 * Characterize error handling for corrupt / invalid input files with real ffmpeg.
 */

import { it, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { convertFiles } from '../../converterManager.js';
import { settings } from '../../utils.js';
import type { ConversionItem } from '../../types/audio.js';
import {
  canRunIntegration,
  integrationSkipReason,
  ffmpegPath,
} from '../test-utils/integrationGuard.js';
import { resolveE2eDescribe } from '../test-utils/e2eDeps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(__dirname, '..', 'test-assets', 'corrupt-input');
const INPUT_DIR = join(TEST_DIR, 'input');
const OUTPUT_DIR = join(TEST_DIR, 'output');

const describeWithDeps = resolveE2eDescribe(
  canRunIntegration,
  integrationSkipReason
);

describeWithDeps('corrupt input integration', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(INPUT_DIR, { recursive: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });

    writeFileSync(join(INPUT_DIR, 'empty.wav'), '');
    writeFileSync(join(INPUT_DIR, 'truncated.wav'), 'RIFF....not-a-wav');
    writeFileSync(
      join(INPUT_DIR, 'text-as-audio.wav'),
      'this is not audio data'
    );

    settings.outputFilePath = OUTPUT_DIR;
    settings.oggCodec = 'vorbis';
    settings.loopDataMode = 'auto';
  }, 30000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('records failures for empty, truncated, and non-audio inputs without crashing', async () => {
    const cases: ConversionItem[] = [
      {
        inputFile: join(INPUT_DIR, 'empty.wav'),
        outputFile: join(OUTPUT_DIR, 'empty.mp3'),
        outputFormat: 'mp3',
      },
      {
        inputFile: join(INPUT_DIR, 'truncated.wav'),
        outputFile: join(OUTPUT_DIR, 'truncated.mp3'),
        outputFormat: 'mp3',
      },
      {
        inputFile: join(INPUT_DIR, 'text-as-audio.wav'),
        outputFile: join(OUTPUT_DIR, 'text-as-audio.mp3'),
        outputFormat: 'mp3',
      },
    ];

    const result = await convertFiles(cases);

    expect(result.successfulFiles).toHaveLength(0);
    expect(result.failedFiles.length).toBeGreaterThanOrEqual(1);
    expect(existsSync(ffmpegPath)).toBe(true);
  }, 120000);

  it('fails a valid WAV with no samples for every format and leaves no file', async () => {
    // 44-byte PCM WAV header with an empty data chunk.
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(2, 22); // stereo
    header.writeUInt32LE(44100, 24);
    header.writeUInt32LE(44100 * 4, 28);
    header.writeUInt16LE(4, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(0, 40);
    const input = join(INPUT_DIR, 'no-samples.wav');
    writeFileSync(input, header);

    const formats = ['mp3', 'ogg', 'flac', 'm4a', 'aiff', 'wav'] as const;
    const cases: ConversionItem[] = formats.map((outputFormat) => ({
      inputFile: input,
      outputFile: join(OUTPUT_DIR, `no-samples-out.${outputFormat}`),
      outputFormat,
    }));

    const result = await convertFiles(cases);

    expect(result.successfulFiles).toHaveLength(0);
    expect(result.failedFiles).toHaveLength(formats.length);
    for (const c of cases) expect(existsSync(c.outputFile)).toBe(false);
  }, 120000);
});
