/**
 * Metadata round-trip characterization: documents which tags survive A→B→A.
 * Uses real ffmpeg when available; skipped locally without binaries.
 */

import { it, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { platform } from 'os';
import { convertFiles } from '../../converterManager.js';
import { settings, findBinary } from '../../utils.js';
import { resolveE2eDescribe } from '../test-utils/e2eDeps.js';
import type { ConversionItem } from '../../types/audio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLATFORM_SLUG =
  platform() === 'win32'
    ? 'windows'
    : platform() === 'darwin'
      ? 'macos'
      : 'linux';
const FFMPEG = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
);
const FFPROBE = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  platform() === 'win32' ? 'ffprobe.exe' : 'ffprobe'
);

const TEST_DIR = join(__dirname, '..', 'test-assets', 'metadata-roundtrip');
const INPUT = join(TEST_DIR, 'source.flac');
const MID = join(TEST_DIR, 'via.mp3');
const BACK = join(TEST_DIR, 'back.flac');

const canRun =
  existsSync(FFMPEG) &&
  existsSync(FFPROBE) &&
  findBinary('converterWorker.js', ['dist']) !== null;

const describeRoundTrip = resolveE2eDescribe(
  canRun,
  'ffmpeg or dist/converterWorker.js missing'
);

const getTag = (filePath: string, tag: string): string | null => {
  const result = spawnSync(
    FFPROBE,
    ['-v', 'quiet', '-print_format', 'json', '-show_format', filePath],
    { encoding: 'utf8', timeout: 15000, windowsHide: true }
  );
  if (result.status !== 0) return null;
  const parsed = JSON.parse(result.stdout) as {
    format?: { tags?: Record<string, string> };
  };
  const tags = parsed.format?.tags ?? {};
  const lower = tag.toLowerCase();
  for (const [key, value] of Object.entries(tags)) {
    if (key.toLowerCase() === lower) return value;
  }
  return null;
};

const generateSource = (): void => {
  mkdirSync(TEST_DIR, { recursive: true });
  const result = spawnSync(
    FFMPEG,
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-metadata',
      'title=RoundTrip 桜',
      '-metadata',
      'artist=Test Artist',
      '-metadata',
      'LOOPSTART=22050',
      '-metadata',
      'LOOPLENGTH=44100',
      '-c:a',
      'flac',
      INPUT,
    ],
    { encoding: 'utf8', timeout: 30000, windowsHide: true }
  );
  if (result.status !== 0) {
    throw new Error(`Failed to generate source FLAC: ${result.stderr}`);
  }
};

describeRoundTrip('metadata round-trip characterization', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    generateSource();
    settings.outputFilePath = TEST_DIR;
    settings.oggCodec = 'vorbis';
    settings.loopDataMode = 'auto';
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('documents title survival through flac → mp3 → flac', async () => {
    const leg1: ConversionItem[] = [
      { inputFile: INPUT, outputFile: MID, outputFormat: 'mp3' },
    ];
    const leg2: ConversionItem[] = [
      { inputFile: MID, outputFile: BACK, outputFormat: 'flac' },
    ];

    expect((await convertFiles(leg1)).failedFiles).toHaveLength(0);
    expect((await convertFiles(leg2)).failedFiles).toHaveLength(0);

    expect(existsSync(BACK)).toBe(true);
    const title = getTag(BACK, 'title');
    expect(title).toBeTruthy();
    expect(title).toContain('RoundTrip');
  }, 120000);
});
