/**
 * Audit: worker exit-0 false-success race
 *
 * Documents conversion-integrity bug when converterWorker posts an error
 * (e.g. mkdirSync failure at converterWorker.ts) and the worker thread exits 0
 * before the parent processes the error message. converterManager treats exit 0
 * with no prior success/failure as success.
 *
 * When fixed: flip the "exit before error" case from characterizing bug to
 * regression guard (expect failedFiles, not successfulFiles).
 */

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
  cpus: jest.fn().mockReturnValue([{}]),
}));

const { Worker } = await import('worker_threads');
const { convertFiles } = await import('../converterManager.js');

type WorkerHandlers = {
  message?: (message: unknown) => void;
  exit?: (code: number) => void;
};

const workerMock = Worker as unknown as jest.MockedFunction<typeof Worker>;

const singleFile: ConversionItem[] = [
  {
    inputFile: 'C:/Music/song.wav',
    outputFile: 'C:/Output/song.mp3',
    outputFormat: 'mp3',
  },
];

describe('converterManager worker race audit', () => {
  const originalConsole = {
    log: console.log,
    error: console.error,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
  });

  it('records failure when error message is processed before exit 0', async () => {
    workerMock.mockImplementation(() => {
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') {
            handlers.message = handler;
          }
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (handlers.message && handlers.exit) {
            handlers.message({
              type: 'error',
              data: 'Failed to create output directory: C:/Output. EACCES',
            });
            handlers.exit(0);
          }

          return worker;
        }),
      };
      return worker as unknown as InstanceType<typeof Worker>;
    });

    const result = await convertFiles(singleFile);

    expect(result.failedFiles).toHaveLength(1);
    expect(result.successfulFiles).toHaveLength(0);
  });

  it('records failure when the worker exits 0 without ever sending a code message', async () => {
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

    const result = await convertFiles(singleFile);

    // Previously this was a false success; the worker must confirm success via a
    // 'code' message, so an exit with no completion signal is now a failure.
    expect(result.successfulFiles).toHaveLength(0);
    expect(result.failedFiles).toHaveLength(1);
  });
});
