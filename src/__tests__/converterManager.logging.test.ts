/**
 * convertFiles must not return until its log writes have finished, otherwise
 * finalize can write the SUMMARY row before the last per-file rows.
 * Also: file paths in ffmpeg's stderr must not trigger fatal-error detection.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { ConversionItem } from '../types/audio.js';
import { createMockWorker } from './test-utils/mockWorker.js';

jest.unstable_mockModule('perf_hooks', () => ({
  performance: { now: jest.fn().mockReturnValue(1000) },
}));
jest.unstable_mockModule('worker_threads', () => ({ Worker: jest.fn() }));
jest.unstable_mockModule('chalk', () => ({
  default: {
    cyanBright: jest.fn((t) => t),
    greenBright: jest.fn((t) => t),
    red: jest.fn((t) => t),
  },
}));
jest.unstable_mockModule('../utils.js', () => ({
  addToLog: jest.fn(),
  settings: { oggCodec: 'vorbis' },
  initializeFileNames: jest.fn(),
  getAnswer: jest.fn(async () => ''),
  isPackagedRuntime: false,
  findBinary: () => '/mock/base/converterWorker.js',
}));
jest.unstable_mockModule('os', () => ({ cpus: jest.fn(() => [{}]) }));

const { Worker } = await import('worker_threads');
const { addToLog, getAnswer } = await import('../utils.js');
const { convertFiles } = await import('../converterManager.js');

const workerMock = Worker as unknown as jest.MockedFunction<
  (...args: unknown[]) => unknown
>;
const addToLogMock = addToLog as unknown as jest.Mock<
  (...args: unknown[]) => Promise<unknown>
>;

const makeFiles = (count: number, dir = '/music'): ConversionItem[] =>
  Array.from({ length: count }, (_, i) => ({
    inputFile: `${dir}/file${i}.wav`,
    outputFile: `${dir}/file${i}.mp3`,
    outputFormat: 'mp3' as const,
  }));

describe('convertFiles log writes and fatal detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    console.info = jest.fn();
  });

  it('waits for pending log writes before returning', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    addToLogMock.mockImplementation(() => gate);
    workerMock.mockImplementation(() => createMockWorker());

    let settled = false;
    const pending = convertFiles(makeFiles(2)).then((r) => {
      settled = true;
      return r;
    });

    await new Promise((r) => setImmediate(r));
    expect(settled).toBe(false);

    release();
    const result = await pending;
    expect(result.successfulFiles).toHaveLength(2);
  });

  it('does not abort the batch when only the file path mentions "Permission denied"', async () => {
    addToLogMock.mockResolvedValue(undefined);
    const files = makeFiles(3, '/music/Permission denied');
    let calls = 0;
    workerMock.mockImplementation(() => {
      calls++;
      if (calls !== 1) return createMockWorker();
      const w = createMockWorker({ manual: true });
      setImmediate(() => {
        w.emitMessage({
          type: 'stderr',
          data: `Error opening input ${files[2]!.inputFile}: Invalid data found when processing input`,
        });
        w.emitMessage({ type: 'error', data: 'ffmpeg exited with code 1' });
        w.emitExit(1);
      });
      return w;
    });

    const result = await convertFiles(files);

    expect(getAnswer).not.toHaveBeenCalled();
    expect(result.successfulFiles).toHaveLength(2);
    expect(result.failedFiles).toHaveLength(1);
  });

  it('fails only that file when ffmpeg reports a permission error (no batch abort)', async () => {
    addToLogMock.mockResolvedValue(undefined);
    const files = makeFiles(3);
    let calls = 0;
    workerMock.mockImplementation(() => {
      calls++;
      if (calls !== 1) return createMockWorker();
      const w = createMockWorker({ manual: true });
      setImmediate(() => {
        w.emitMessage({
          type: 'stderr',
          data: `${files[2]!.outputFile}: Permission denied`,
        });
        w.emitExit(1);
      });
      return w;
    });

    const result = await convertFiles(files);

    // A read-only output affects one file; the rest of the batch carries on.
    expect(getAnswer).not.toHaveBeenCalled();
    expect(result.successfulFiles).toHaveLength(2);
    expect(result.failedFiles).toHaveLength(1);
  });
});
