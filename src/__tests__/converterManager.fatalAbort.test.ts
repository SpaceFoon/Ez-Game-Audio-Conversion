/**
 * Regression tests: after a fatal ffmpeg error (disk full / permission denied)
 * every file in the batch must be accounted for, and the user is prompted once.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { ConversionItem } from '../types/audio.js';
import { createMockWorker } from './test-utils/mockWorker.js';

jest.unstable_mockModule('perf_hooks', () => ({
  performance: { now: jest.fn().mockReturnValue(1000) },
}));

jest.unstable_mockModule('worker_threads', () => ({
  Worker: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => ({
  default: {
    cyanBright: jest.fn((text) => text),
    greenBright: jest.fn((text) => text),
    red: jest.fn((text) => text),
  },
}));

jest.unstable_mockModule('../utils.js', () => ({
  addToLog: jest.fn(),
  settings: { oggCodec: 'vorbis' },
  initializeFileNames: jest.fn(),
  getAnswer: jest.fn(),
  isPackagedRuntime: false,
  findBinary: () => '/mock/base/converterWorker.js',
}));

jest.unstable_mockModule('os', () => ({
  cpus: jest.fn().mockReturnValue([{}, {}]),
}));

const { Worker } = await import('worker_threads');
const { getAnswer } = await import('../utils.js');
const { convertFiles } = await import('../converterManager.js');

const workerMock = Worker as unknown as jest.MockedFunction<
  (...args: unknown[]) => unknown
>;
const getAnswerMock = getAnswer as unknown as jest.Mock<
  (prompt?: unknown) => Promise<string>
>;

const makeFiles = (count: number): ConversionItem[] =>
  Array.from({ length: count }, (_, i) => ({
    inputFile: `/music/file${i}.wav`,
    outputFile: `/music/file${i}.mp3`,
    outputFormat: 'mp3' as const,
  }));

describe('convertFiles fatal abort accounting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    getAnswerMock.mockResolvedValue('');
  });

  it('records queued files as failed when the batch aborts', async () => {
    let calls = 0;
    workerMock.mockImplementation(() => {
      calls++;
      return createMockWorker(
        calls === 1
          ? { triggerStderr: true, noSpaceLeft: true, exitCode: 1 }
          : {}
      );
    });

    const files = makeFiles(5);
    const result = await convertFiles(files);

    expect(result.failedFiles.length + result.successfulFiles.length).toBe(5);
    const skipped = result.failedFiles.filter((f) =>
      /aborted/i.test(f.error ?? '')
    );
    expect(skipped.length).toBeGreaterThan(0);
    const accounted = new Set(
      [...result.failedFiles, ...result.successfulFiles].map(
        (f) => f.outputFile
      )
    );
    for (const file of files) expect(accounted.has(file.outputFile)).toBe(true);
  });

  it('prompts only once when several workers hit a fatal error', async () => {
    const workers: ReturnType<typeof createMockWorker>[] = [];
    workerMock.mockImplementation(() => {
      const w = createMockWorker({ manual: true });
      workers.push(w);
      return w;
    });

    const pending = convertFiles(makeFiles(4));
    await Promise.resolve();
    expect(workers).toHaveLength(2);

    for (const w of workers) {
      w.emitMessage({ type: 'stderr', data: 'No space left on device' });
    }
    for (const w of workers) w.emitExit(1);

    const result = await pending;

    const enterPrompts = getAnswerMock.mock.calls.filter(([p]) =>
      /Press ENTER/i.test(String(p))
    );
    expect(enterPrompts).toHaveLength(1);
    expect(result.failedFiles).toHaveLength(4);
  });
});
