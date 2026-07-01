/**
 * Real worker ↔ manager protocol tests using dist/converterWorker.js and bundled ffmpeg.
 * Validates message ordering and success/failure accounting without mocked workers.
 */

import { it, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { convertFiles } from '../converterManager.js';
import { settings } from '../utils.js';
import type { ConversionItem } from '../types/audio.js';
import {
  canRunIntegration,
  ffmpegPath,
  ffprobePath,
  integrationSkipReason,
} from './test-utils/ffmpegGate.js';
import { resolveE2eDescribe } from './test-utils/e2eDeps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(__dirname, 'test-assets', 'worker-protocol');
const INPUT_DIR = join(TEST_DIR, 'input');
const OUTPUT_DIR = join(TEST_DIR, 'output');

const describeProtocol = resolveE2eDescribe(
  canRunIntegration,
  integrationSkipReason ||
    'ffmpeg or dist/converterWorker.js missing — run npm run build and npm run install:ffmpeg'
);

const generateWav = (filePath: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  const result = spawnSync(
    ffmpegPath,
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=0.5',
      '-c:a',
      'pcm_s16le',
      filePath,
    ],
    { encoding: 'utf8', timeout: 15000, windowsHide: true }
  );
  if (result.status !== 0) {
    throw new Error(`Failed to generate WAV: ${result.stderr}`);
  }
};

describeProtocol('worker protocol (real Worker + ffmpeg)', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(INPUT_DIR, { recursive: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });

    generateWav(join(INPUT_DIR, 'valid.wav'));
    settings.outputFilePath = OUTPUT_DIR;
    settings.oggCodec = 'vorbis';
    settings.loopDataMode = 'auto';
  }, 60000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('records successful conversion in successfulFiles', async () => {
    const inputFile = join(INPUT_DIR, 'valid.wav');
    const outputFile = join(OUTPUT_DIR, 'valid-out.mp3');
    const job: ConversionItem = {
      inputFile,
      outputFile,
      outputFormat: 'mp3',
    };

    const result = await convertFiles([job]);

    expect(result.failedFiles).toHaveLength(0);
    expect(result.successfulFiles).toHaveLength(1);
    expect(result.successfulFiles[0].outputFile).toBe(outputFile);
    expect(existsSync(outputFile)).toBe(true);
  }, 60000);

  it('records missing input in failedFiles, not successfulFiles', async () => {
    const job: ConversionItem = {
      inputFile: join(INPUT_DIR, 'does-not-exist.wav'),
      outputFile: join(OUTPUT_DIR, 'missing-out.mp3'),
      outputFormat: 'mp3',
    };

    const result = await convertFiles([job]);

    expect(result.failedFiles).toHaveLength(1);
    expect(result.successfulFiles).toHaveLength(0);
    expect(result.failedFiles[0].inputFile).toBe(job.inputFile);
  }, 60000);

  it('records mkdir failure in failedFiles only', async () => {
    const inputFile = join(INPUT_DIR, 'valid.wav');
    // Parent path is a file, so mkdirSync for output dir fails
    const fileAsParent = join(TEST_DIR, 'not-a-dir');
    writeFileSync(fileAsParent, 'block');
    const outputFile = join(fileAsParent, 'out.mp3');

    try {
      const result = await convertFiles([
        { inputFile, outputFile, outputFormat: 'mp3' },
      ]);

      expect(result.failedFiles.length).toBeGreaterThanOrEqual(1);
      expect(
        result.successfulFiles.some((f) => f.outputFile === outputFile)
      ).toBe(false);
    } finally {
      if (existsSync(fileAsParent)) {
        rmSync(fileAsParent, { force: true });
      }
    }
  }, 60000);

  it('rejects corrupt input without marking success', async () => {
    const corruptPath = join(INPUT_DIR, 'corrupt.wav');
    writeFileSync(corruptPath, 'not-a-wav');
    const outputFile = join(OUTPUT_DIR, 'corrupt-out.mp3');

    const result = await convertFiles([
      { inputFile: corruptPath, outputFile, outputFormat: 'mp3' },
    ]);

    expect(result.failedFiles).toHaveLength(1);
    expect(result.successfulFiles).toHaveLength(0);
  }, 60000);

  it('verifies output with ffprobe after successful conversion', async () => {
    const inputFile = join(INPUT_DIR, 'valid.wav');
    const outputFile = join(OUTPUT_DIR, 'probe-out.flac');
    const result = await convertFiles([
      { inputFile, outputFile, outputFormat: 'flac' },
    ]);

    expect(result.failedFiles).toHaveLength(0);
    const probe = spawnSync(
      ffprobePath,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        outputFile,
      ],
      { encoding: 'utf8', timeout: 15000, windowsHide: true }
    );
    expect(probe.status).toBe(0);
    expect(parseFloat(probe.stdout.trim())).toBeGreaterThan(0);
  }, 60000);
});
