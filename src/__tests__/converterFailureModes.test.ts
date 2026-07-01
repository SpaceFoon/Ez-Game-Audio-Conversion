import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import type { ConversionItem } from '../types/audio.js';

jest.unstable_mockModule('perf_hooks', () => ({
  performance: {
    now: jest.fn().mockReturnValue(1000),
  },
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
  rl: {
    question: jest.fn((_question: string, callback: () => void) => callback()),
  },
  getAnswer: jest.fn().mockResolvedValue(''),
  runtimeBaseDir: '/mock/base',
  isPackagedRuntime: false,
  findBinary: () => '/mock/base/converterWorker.js',
}));

jest.unstable_mockModule('os', () => ({
  cpus: jest.fn().mockReturnValue([{}, {}]),
}));

const { Worker } = await import('worker_threads');
const { getAnswer } = await import('../utils.js');
const { convertFiles } = await import('../converterManager.js');

type WorkerHandlers = {
  message?: (message: unknown) => void;
  error?: (error: unknown) => void;
  exit?: (code: number) => void;
};

const workerMock = Worker as unknown as jest.MockedFunction<typeof Worker>;
const getAnswerMock = getAnswer as unknown as jest.MockedFunction<
  typeof getAnswer
>;

const createTestFiles = (count: number): ConversionItem[] =>
  Array.from({ length: count }, (_, i) => ({
    inputFile: `C:/Music/testfile${i}.mp3`,
    outputFile: `C:/Music/testfile${i}.ogg`,
    outputFormat: 'ogg' as const,
  }));

describe('converter failure modes', () => {
  const originalConsole = {
    log: console.log,
    error: console.error,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getAnswerMock.mockResolvedValue('');
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
  });

  it('records worker thread errors and continues the batch', async () => {
    let callIndex = 0;
    workerMock.mockImplementation(() => {
      callIndex++;
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') handlers.message = handler;
          if (event === 'error') handlers.error = handler;
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (callIndex === 1 && event === 'error' && handlers.error) {
            handlers.error(new Error('Worker thread crashed'));
          } else if (
            callIndex === 2 &&
            event === 'message' &&
            handlers.message
          ) {
            handlers.message({ type: 'code', data: 0 });
          } else if (event === 'exit' && handlers.exit) {
            handlers.exit(callIndex === 1 ? 1 : 0);
          }

          return worker;
        }),
      };
      return worker as unknown as InstanceType<typeof Worker>;
    });

    const result = await convertFiles(createTestFiles(2));

    expect(result.failedFiles).toHaveLength(1);
    expect(result.successfulFiles).toHaveLength(1);
  });

  it('skips remaining queued jobs after fatal stderr abort', async () => {
    let workerCount = 0;
    workerMock.mockImplementation(() => {
      workerCount++;
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') handlers.message = handler;
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (workerCount === 1 && event === 'message' && handlers.message) {
            handlers.message({
              type: 'stderr',
              data: 'no space left on device',
            });
          }
          if (event === 'exit' && handlers.exit) {
            handlers.exit(workerCount === 1 ? 1 : 0);
          }

          return worker;
        }),
      };
      return worker as unknown as InstanceType<typeof Worker>;
    });

    const result = await convertFiles(createTestFiles(5));

    expect(result.failedFiles.length).toBeGreaterThanOrEqual(1);
    expect(result.successfulFiles.length).toBeLessThan(5);
    expect(getAnswerMock).toHaveBeenCalled();
  });

  it('deduplicates failures for the same output path', async () => {
    const sharedOutput = 'C:/Music/shared.ogg';
    const files: ConversionItem[] = [
      {
        inputFile: 'C:/Music/a.mp3',
        outputFile: sharedOutput,
        outputFormat: 'ogg',
      },
      {
        inputFile: 'C:/Music/b.mp3',
        outputFile: sharedOutput,
        outputFormat: 'ogg',
      },
    ];

    workerMock.mockImplementation(() => {
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') handlers.message = handler;
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (event === 'message' && handlers.message) {
            handlers.message({ type: 'error', data: 'conversion failed' });
          }
          if (event === 'exit' && handlers.exit) {
            handlers.exit(1);
          }

          return worker;
        }),
      };
      return worker as unknown as InstanceType<typeof Worker>;
    });

    const result = await convertFiles(files);

    expect(result.failedFiles).toHaveLength(1);
    expect(result.failedFiles[0].outputFile).toBe(sharedOutput);
  });

  it('treats worker exit 0 without a code message as a failure (no false success)', async () => {
    workerMock.mockImplementation(() => {
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (event === 'exit' && handlers.exit) {
            handlers.exit(0);
          }

          return worker;
        }),
      };
      return worker as unknown as InstanceType<typeof Worker>;
    });

    const result = await convertFiles(createTestFiles(1));

    // A clean OS exit code is not proof the conversion happened. Success must be
    // confirmed by the worker's 'code' message, so an unconfirmed exit is a failure.
    expect(result.successfulFiles).toHaveLength(0);
    expect(result.failedFiles).toHaveLength(1);
  });
});
