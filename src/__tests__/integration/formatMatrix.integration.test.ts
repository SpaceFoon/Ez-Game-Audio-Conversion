/**
 * Real end-to-end conversion matrix: actual worker threads + bundled ffmpeg.
 *
 * Unlike most unit tests (mocked workers/spawn), this exercises convertFiles()
 * the same way the shipped app does. Skipped when ffmpeg or dist/converterWorker.js
 * is missing — run `npm run build` first in dev.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { platform } from 'os';
import { convertFiles } from '../../converterManager.js';
import { findBinary, settings } from '../../utils.js';
import type { AudioFormat, ConversionItem } from '../../types/audio.js';
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

const TEST_DIR = join(__dirname, '..', 'test-assets', 'format-matrix');
const INPUT_DIR = join(TEST_DIR, 'input');
const OUTPUT_DIR = join(TEST_DIR, 'output');

const INPUT_FORMATS: AudioFormat[] = [
  'wav',
  'mp3',
  'ogg',
  'flac',
  'm4a',
  'aiff',
];
const OUTPUT_FORMATS: AudioFormat[] = [...INPUT_FORMATS];

const ffmpegAvailable = existsSync(FFMPEG_PATH) && existsSync(FFPROBE_PATH);
const workerAvailable = findBinary('converterWorker.js', ['dist']) !== null;
const canRun = ffmpegAvailable && workerAvailable;

const verifyAudio = (
  filePath: string
): { valid: boolean; duration: number | null; error?: string } => {
  const result = spawnSync(
    FFPROBE_PATH,
    [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ],
    { encoding: 'utf8', timeout: 15000, windowsHide: true }
  );

  if (result.status !== 0) {
    return { valid: false, duration: null, error: result.stderr };
  }

  const duration = parseFloat(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      valid: false,
      duration: null,
      error: `Invalid duration: ${result.stdout.trim()}`,
    };
  }

  return { valid: true, duration };
};

const describeWithDeps = canRun ? describe : describe.skip;

describeWithDeps('format conversion matrix (real workers + ffmpeg)', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(INPUT_DIR, { recursive: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });

    const generated = generateTestFiles.generateTestAudioFiles(INPUT_DIR, {
      formats: INPUT_FORMATS,
      duration: 1,
      title: 'Matrix Test',
      artist: 'EZ Game Audio',
    });

    const missing = INPUT_FORMATS.filter((fmt) => !generated[fmt]);
    if (missing.length > 0) {
      throw new Error(
        `Failed to generate input formats: ${missing.join(', ')}`
      );
    }

    settings.outputFilePath = OUTPUT_DIR;
    settings.oggCodec = 'vorbis';
    settings.loopDataMode = 'auto';
  }, 120000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('converts every input format to every output format with zero failures', async () => {
    const inputFiles = readdirSync(INPUT_DIR)
      .filter((file) =>
        INPUT_FORMATS.includes(
          extname(file).slice(1).toLowerCase() as AudioFormat
        )
      )
      .map((file) => join(INPUT_DIR, file));

    expect(inputFiles.length).toBe(INPUT_FORMATS.length);

    const jobs: ConversionItem[] = [];

    for (const inputFile of inputFiles) {
      const inputFmt = extname(inputFile).slice(1).toLowerCase() as AudioFormat;

      for (const outputFmt of OUTPUT_FORMATS) {
        const base = basename(inputFile, extname(inputFile));
        jobs.push({
          inputFile,
          outputFile: join(
            OUTPUT_DIR,
            `${base}_${inputFmt}_to_${outputFmt}.${outputFmt}`
          ),
          outputFormat: outputFmt,
        });
      }
    }

    expect(jobs).toHaveLength(INPUT_FORMATS.length * OUTPUT_FORMATS.length);

    const result = await convertFiles(jobs);

    if (result.failedFiles.length > 0) {
      const summary = result.failedFiles
        .map(
          (f) =>
            `${basename(f.inputFile)} → ${basename(f.outputFile)}: ${f.error ?? 'unknown'}`
        )
        .join('\n');
      throw new Error(
        `${result.failedFiles.length} conversion(s) failed:\n${summary}`
      );
    }

    expect(result.successfulFiles).toHaveLength(jobs.length);

    for (const job of jobs) {
      expect(existsSync(job.outputFile)).toBe(true);
      const integrity = verifyAudio(job.outputFile);
      expect(integrity.valid).toBe(true);
    }
  }, 300000);

  it('converts loop-tagged wav to mp3 and ogg in a focused subset', async () => {
    const loopInput = join(INPUT_DIR, 'loop_44100.wav');
    expect(existsSync(loopInput)).toBe(true);

    const subsetJobs: ConversionItem[] = (['mp3', 'ogg'] as AudioFormat[]).map(
      (outputFmt) => ({
        inputFile: loopInput,
        outputFile: join(OUTPUT_DIR, `loop-matrix.${outputFmt}`),
        outputFormat: outputFmt,
      })
    );

    const result = await convertFiles(subsetJobs);
    expect(result.failedFiles).toHaveLength(0);
    for (const job of subsetJobs) {
      expect(existsSync(job.outputFile)).toBe(true);
      expect(verifyAudio(job.outputFile).valid).toBe(true);
    }
  }, 120000);

  it('logs paths with formula-like names without corrupting CSV rows', async () => {
    const { initializeFileNames, addToLog } = await import('../../utils.js');
    const formulaDir = join(OUTPUT_DIR, '=formula-test');
    mkdirSync(formulaDir, { recursive: true });

    settings.outputFilePath = formulaDir;
    initializeFileNames();

    const maliciousInput = '=SUM(A1).wav';
    const maliciousOutput = '+cmd.ogg';

    // Paths logged to CSV — formula chars at field start must be neutralized.
    await addToLog(
      { type: 'stderr', data: '@injected' },
      { inputFile: maliciousInput, outputFile: maliciousOutput }
    );

    const errorCsv = readdirSync(formulaDir).find((f) => f.startsWith('error'));
    expect(errorCsv).toBeDefined();

    const content = readFileSync(join(formulaDir, errorCsv!), 'utf8');
    const dataLine = content.trim().split('\n').pop() ?? '';
    expect(dataLine).toContain("'=SUM(A1).wav");
    expect(dataLine).toContain("'+cmd.ogg");
    expect(dataLine).toContain("'@injected");
  }, 30000);
});
