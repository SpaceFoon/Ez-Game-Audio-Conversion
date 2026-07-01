/**
 * Real end-to-end conversion matrix: actual worker threads + bundled ffmpeg.
 *
 * Unlike most unit tests (mocked workers/spawn), this exercises convertFiles()
 * the same way the shipped app does. Skipped when ffmpeg or dist/converterWorker.js
 * is missing — run `npm run build` first in dev.
 */

import { it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { convertFiles } from '../../converterManager.js';
import { settings } from '../../utils.js';
import type { AudioFormat, ConversionItem } from '../../types/audio.js';
import generateTestFiles from '../test-utils/generateTestFiles.js';
import {
  canRunIntegration,
  ffmpegPath as FFMPEG_PATH,
  ffprobePath as FFPROBE_PATH,
  integrationSkipReason,
} from '../test-utils/ffmpegGate.js';
import { resolveE2eDescribe } from '../test-utils/e2eDeps.js';
import metadataHelpers from '../test-utils/metadataHelpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const describeWithDeps = resolveE2eDescribe(
  canRunIntegration,
  integrationSkipReason ||
    'ffmpeg or dist/converterWorker.js missing — run npm run build and npm run install:ffmpeg'
);

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

const LOOP_WRITE_FORMATS: AudioFormat[] = ['mp3', 'ogg', 'flac', 'aiff'];

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

  it('round-trips loop points to formats that support loop metadata writes', async () => {
    const loopInput = join(INPUT_DIR, 'loop_44100.wav');
    expect(existsSync(loopInput)).toBe(true);

    const sourceMeta = metadataHelpers.extractMetadata(loopInput);
    const sourceLoops = metadataHelpers.extractLoopPoints(sourceMeta);
    expect(sourceLoops.loopStart).not.toBeNull();
    expect(sourceLoops.loopLength).not.toBeNull();

    for (const outputFmt of LOOP_WRITE_FORMATS) {
      const outputFile = join(OUTPUT_DIR, `loop-roundtrip.${outputFmt}`);
      const result = await convertFiles([
        { inputFile: loopInput, outputFile, outputFormat: outputFmt },
      ]);

      expect(result.failedFiles).toHaveLength(0);
      expect(existsSync(outputFile)).toBe(true);

      const outMeta = metadataHelpers.extractMetadata(outputFile);
      const outLoops = metadataHelpers.extractLoopPoints(outMeta);
      expect(outLoops.loopStart).toBe(sourceLoops.loopStart);
      expect(outLoops.loopLength).toBe(sourceLoops.loopLength);
    }
  }, 180000);

  it('adjusts loop points when converting to opus at tier sample rates', async () => {
    settings.oggCodec = 'opus';
    const loopInput = join(INPUT_DIR, 'loop_44100.wav');
    const outputFile = join(OUTPUT_DIR, 'loop-opus-tier.ogg');

    const result = await convertFiles([
      { inputFile: loopInput, outputFile, outputFormat: 'ogg' },
    ]);

    expect(result.failedFiles).toHaveLength(0);

    const probe = spawnSync(
      FFPROBE_PATH,
      [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=sample_rate,codec_name',
        '-show_format',
        '-print_format',
        'json',
        outputFile,
      ],
      { encoding: 'utf8', timeout: 15000, windowsHide: true }
    );
    expect(probe.status).toBe(0);
    const parsed = JSON.parse(probe.stdout) as {
      streams?: Array<{ codec_name?: string; sample_rate?: string }>;
    };
    expect(parsed.streams?.[0]?.codec_name).toBe('opus');
    const outRate = parseInt(parsed.streams?.[0]?.sample_rate ?? '0', 10);
    expect([8000, 12000, 16000, 24000, 48000]).toContain(outRate);

    settings.oggCodec = 'vorbis';
  }, 120000);

  it('converts ogg outputs using opus codec', async () => {
    settings.oggCodec = 'opus';

    const oggInputs = readdirSync(INPUT_DIR).filter(
      (f) => extname(f).slice(1).toLowerCase() === 'ogg'
    );
    expect(oggInputs.length).toBeGreaterThan(0);

    const inputFile = join(INPUT_DIR, oggInputs[0]);
    const jobs: ConversionItem[] = OUTPUT_FORMATS.map((outputFmt) => ({
      inputFile,
      outputFile: join(
        OUTPUT_DIR,
        `opus_codec_${basename(inputFile, extname(inputFile))}_to_${outputFmt}.${outputFmt}`
      ),
      outputFormat: outputFmt,
    }));

    const result = await convertFiles(jobs);
    if (result.failedFiles.length > 0) {
      throw new Error(
        result.failedFiles.map((f) => f.error ?? 'unknown').join('\n')
      );
    }

    for (const job of jobs) {
      expect(existsSync(job.outputFile)).toBe(true);
      expect(verifyAudio(job.outputFile).valid).toBe(true);
    }

    if (jobs.some((j) => j.outputFormat === 'ogg')) {
      const oggJob = jobs.find((j) => j.outputFormat === 'ogg')!;
      const probe = spawnSync(
        FFPROBE_PATH,
        [
          '-v',
          'error',
          '-select_streams',
          'a:0',
          '-show_entries',
          'stream=sample_rate,codec_name',
          '-of',
          'json',
          oggJob.outputFile,
        ],
        { encoding: 'utf8', timeout: 15000, windowsHide: true }
      );
      expect(probe.status).toBe(0);
      const parsed = JSON.parse(probe.stdout) as {
        streams?: Array<{ codec_name?: string; sample_rate?: string }>;
      };
      expect(parsed.streams?.[0]?.codec_name).toBe('opus');
    }
  }, 300000);

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

  it('converts wav to wav (same-format re-encode) without self-overwrite', async () => {
    const inputFile = join(INPUT_DIR, 'loop_44100.wav');
    expect(existsSync(inputFile)).toBe(true);

    const job: ConversionItem = {
      inputFile,
      outputFile: join(OUTPUT_DIR, 'same-format-copy.wav'),
      outputFormat: 'wav',
    };

    const result = await convertFiles([job]);
    expect(result.failedFiles).toHaveLength(0);
    expect(verifyAudio(job.outputFile).valid).toBe(true);
  }, 60000);

  it('uses opus codec settings when settings.oggCodec is opus', async () => {
    settings.oggCodec = 'opus';
    const inputFile = join(INPUT_DIR, 'loop_44100.wav');
    const outputFile = join(OUTPUT_DIR, 'opus-matrix.ogg');

    const result = await convertFiles([
      { inputFile, outputFile, outputFormat: 'ogg' },
    ]);

    expect(result.failedFiles).toHaveLength(0);
    expect(verifyAudio(outputFile).valid).toBe(true);
    settings.oggCodec = 'vorbis';
  }, 60000);

  it('fails gracefully on corrupt and zero-byte inputs without hanging', async () => {
    const corruptPath = join(INPUT_DIR, 'corrupt.wav');
    const emptyPath = join(INPUT_DIR, 'empty.wav');
    writeFileSync(corruptPath, 'not-a-wav-file');
    writeFileSync(emptyPath, '');

    const result = await convertFiles([
      {
        inputFile: corruptPath,
        outputFile: join(OUTPUT_DIR, 'corrupt-out.mp3'),
        outputFormat: 'mp3',
      },
      {
        inputFile: emptyPath,
        outputFile: join(OUTPUT_DIR, 'empty-out.mp3'),
        outputFormat: 'mp3',
      },
    ]);

    expect(result.failedFiles.length).toBe(2);
    expect(result.successfulFiles).toHaveLength(0);
  }, 120000);

  it('converts very short audio (<100ms) without failure', async () => {
    const shortPath = join(INPUT_DIR, 'short.wav');
    const gen = spawnSync(
      FFMPEG_PATH,
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=0.05',
        '-c:a',
        'pcm_s16le',
        shortPath,
      ],
      { encoding: 'utf8', timeout: 15000, windowsHide: true }
    );
    expect(gen.status).toBe(0);

    const outputFile = join(OUTPUT_DIR, 'short-out.mp3');
    const result = await convertFiles([
      { inputFile: shortPath, outputFile, outputFormat: 'mp3' },
    ]);

    expect(result.failedFiles).toHaveLength(0);
    expect(verifyAudio(outputFile).valid).toBe(true);
  }, 120000);
});
