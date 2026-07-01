/**
 * Worker pool saturation and mixed batch behavior with real ffmpeg + workers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';
import { convertFiles } from '../../converterManager.js';
import { findBinary, settings } from '../../utils.js';
import type { ConversionItem } from '../../types/audio.js';
import generateTestFiles from '../test-utils/generateTestFiles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLATFORM_SLUG =
  platform() === 'win32'
    ? 'windows'
    : platform() === 'darwin'
      ? 'macos'
      : 'linux';
const FFMPEG_EXE = platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const FFPROBE_EXE = platform() === 'win32' ? 'ffprobe.exe' : 'ffprobe';
const FFMPEG_PATH = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  FFMPEG_EXE
);
const FFPROBE_PATH = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  FFPROBE_EXE
);

const TEST_DIR = join(__dirname, '..', 'test-assets', 'concurrency');
const INPUT_DIR = join(TEST_DIR, 'input');
const OUTPUT_DIR = join(TEST_DIR, 'output');

const ffmpegAvailable = existsSync(FFMPEG_PATH) && existsSync(FFPROBE_PATH);
const workerAvailable = findBinary('converterWorker.js', ['dist']) !== null;
const canRun = ffmpegAvailable && workerAvailable;

const describeWithDeps = canRun ? describe : describe.skip;

describeWithDeps('concurrency integration (real workers + ffmpeg)', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(INPUT_DIR, { recursive: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });

    generateTestFiles.generateTestAudioFiles(INPUT_DIR, {
      formats: ['wav'],
      duration: 0.5,
      title: 'Concurrency',
      artist: 'EZ Game Audio',
    });

    settings.outputFilePath = OUTPUT_DIR;
    settings.oggCodec = 'vorbis';
    settings.loopDataMode = 'auto';
  }, 120000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('processes 50+ files through the worker pool with zero failures', async () => {
    const source = join(INPUT_DIR, 'loop_44100.wav');
    expect(existsSync(source)).toBe(true);

    const jobs: ConversionItem[] = Array.from({ length: 52 }, (_, index) => ({
      inputFile: source,
      outputFile: join(OUTPUT_DIR, `batch-${index}.mp3`),
      outputFormat: 'mp3',
    }));

    const result = await convertFiles(jobs);
    expect(result.failedFiles).toHaveLength(0);
    expect(result.successfulFiles).toHaveLength(52);
  }, 300000);

  it('returns partial success when some inputs are corrupt', async () => {
    // generateTestAudioFiles emits loop_<sampleRate>.wav, so use that as the
    // known-good source rather than a name that was never created.
    const good = join(INPUT_DIR, 'loop_44100.wav');
    const corrupt = join(INPUT_DIR, 'bad.wav');
    writeFileSync(corrupt, 'corrupt-data');

    const jobs: ConversionItem[] = [
      {
        inputFile: good,
        outputFile: join(OUTPUT_DIR, 'mixed-good.mp3'),
        outputFormat: 'mp3',
      },
      {
        inputFile: corrupt,
        outputFile: join(OUTPUT_DIR, 'mixed-bad.mp3'),
        outputFormat: 'mp3',
      },
      {
        inputFile: good,
        outputFile: join(OUTPUT_DIR, 'mixed-good-2.mp3'),
        outputFormat: 'mp3',
      },
    ];

    const result = await convertFiles(jobs);
    expect(result.successfulFiles.length).toBe(2);
    expect(result.failedFiles.length).toBe(1);
  }, 180000);
});
