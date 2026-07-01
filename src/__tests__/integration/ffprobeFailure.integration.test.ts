/**
 * Real ffmpeg integration: ffprobe failure aborts conversion (KB-001 regression).
 */

import { it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readdirSync,
  readFileSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { convertFiles } from '../../converterManager.js';
import { settings, initializeFileNames } from '../../utils.js';
import {
  canRunIntegration,
  integrationSkipReason,
  resolveE2eDescribe,
} from '../test-utils/e2eDeps.js';
import generateTestFiles from '../test-utils/generateTestFiles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(__dirname, '..', 'test-assets', 'ffprobe-failure');
const INPUT_DIR = join(TEST_DIR, 'input');
const OUTPUT_DIR = join(TEST_DIR, 'output');

const describeWithDeps = resolveE2eDescribe(
  canRunIntegration,
  integrationSkipReason
);

describeWithDeps('ffprobe failure integration', () => {
  beforeAll(() => {
    if (!canRunIntegration) return;

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(INPUT_DIR, { recursive: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });

    generateTestFiles.generateTestAudioFiles(INPUT_DIR, {
      formats: ['wav'],
      duration: 0.5,
    });

    settings.outputFilePath = OUTPUT_DIR;
    settings.oggCodec = 'vorbis';
    initializeFileNames();
  }, 60000);

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('fails conversion when ffprobe cannot read metadata (corrupt input)', async () => {
    const corruptPath = join(INPUT_DIR, 'corrupt-for-ffprobe.wav');
    writeFileSync(corruptPath, 'not-valid-audio-data');

    const outputFile = join(OUTPUT_DIR, 'corrupt-out.mp3');
    const result = await convertFiles([
      {
        inputFile: corruptPath,
        outputFile,
        outputFormat: 'mp3',
      },
    ]);

    expect(result.successfulFiles).toHaveLength(0);
    expect(result.failedFiles).toHaveLength(1);
    expect(result.failedFiles[0].error).toMatch(/ffprobe failed/i);
    expect(existsSync(outputFile)).toBe(false);

    const errorCsv = readdirSync(OUTPUT_DIR).find((f) => f.startsWith('error'));
    expect(errorCsv).toBeDefined();
    const logContent = readFileSync(join(OUTPUT_DIR, errorCsv!), 'utf8');
    expect(logContent).toContain('corrupt-for-ffprobe.wav');
  }, 120000);

  it('succeeds when ffprobe can read valid input metadata', async () => {
    const validInput = join(INPUT_DIR, 'loop_44100.wav');
    expect(existsSync(validInput)).toBe(true);

    const outputFile = join(OUTPUT_DIR, 'valid-out.mp3');
    const result = await convertFiles([
      {
        inputFile: validInput,
        outputFile,
        outputFormat: 'mp3',
      },
    ]);

    expect(result.failedFiles).toHaveLength(0);
    expect(result.successfulFiles).toHaveLength(1);
    expect(existsSync(outputFile)).toBe(true);
  }, 120000);
});
