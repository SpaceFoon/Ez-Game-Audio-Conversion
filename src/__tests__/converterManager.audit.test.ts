import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { ConversionItem } from '../types/audio.js';

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
    bgRed: jest.fn((text) => text),
  },
  cyanBright: jest.fn((text) => text),
  greenBright: jest.fn((text) => text),
  red: jest.fn((text) => text),
  bgRed: jest.fn((text) => text),
}));

jest.unstable_mockModule('../utils.js', () => ({
  isFileBusy: jest.fn(),
  addToLog: jest.fn(),
  settings: { oggCodec: 'vorbis' },
  initializeFileNames: jest.fn(),
  getAnswer: jest.fn().mockResolvedValue(''),
  runtimeBaseDir: '/mock/base',
  isPackagedRuntime: false,
  findBinary: () => '/mock/base/converterWorker.js',
}));

jest.unstable_mockModule('os', () => ({
  cpus: jest.fn().mockReturnValue([{}, {}]),
}));

const { Worker } = await import('worker_threads');
const { convertFiles } = await import('../converterManager.js');

type WorkerHandlers = {
  message?: (message: unknown) => void;
  exit?: (code: number) => void;
};

const workerMock = Worker as unknown as jest.MockedFunction<typeof Worker>;

const makeFiles = (count: number): ConversionItem[] =>
  Array.from({ length: count }, (_, i) => ({
    inputFile: `C:/Music/file${i}.wav`,
    outputFile: `C:/Music/file${i}.mp3`,
    outputFormat: 'mp3' as const,
  }));

describe('audit characterization: converterManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  it('silently drops queued jobs after fatal disk-space stderr (not counted as failed)', async () => {
    let workerIndex = 0;
    workerMock.mockImplementation(() => {
      workerIndex++;
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') handlers.message = handler;
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (workerIndex === 1 && event === 'message' && handlers.message) {
            handlers.message({
              type: 'stderr',
              data: 'no space left on device',
            });
          }
          if (event === 'exit' && handlers.exit) {
            handlers.exit(workerIndex === 1 ? 1 : 0);
          }

          return worker;
        }),
      };
      return worker as unknown as InstanceType<typeof Worker>;
    });

    const result = await convertFiles(makeFiles(5));

    expect(result.failedFiles.length).toBeGreaterThanOrEqual(1);
    expect(result.successfulFiles.length).toBeLessThan(5);
    expect(
      result.failedFiles.length + result.successfulFiles.length
    ).toBeLessThan(5);
  });
});
