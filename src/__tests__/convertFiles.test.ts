// src/__tests__/convertFiles.test.js
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import type { ConversionItem } from '../types/audio.js';

// ESM mocks must be declared BEFORE dynamic imports
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
  getAnswer: jest.fn(),
  runtimeBaseDir: '/mock/base',
  isPackagedRuntime: false,
  findBinary: () => '/mock/base/converterWorker.js',
}));

jest.unstable_mockModule('os', () => ({
  cpus: jest.fn().mockReturnValue([{}, {}, {}, {}]), // Mock 4 CPUs
}));

// Dynamic imports after mock declarations
const { Worker } = await import('worker_threads');
const os = await import('os');
const { getAnswer, addToLog } = await import('../utils.js');
const { convertFiles } = await import('../converterManager.js');
import events from 'events';

type WorkerHandlers = {
  message?: (message: unknown) => void;
  error?: (error: unknown) => void;
  exit?: (code: number) => void;
};

const workerMock = Worker as unknown as jest.MockedFunction<any>;
const cpusMock = os.cpus as unknown as jest.MockedFunction<typeof os.cpus>;
const getAnswerMock = getAnswer as unknown as jest.MockedFunction<
  typeof getAnswer
>;
const addToLogMock = addToLog as unknown as jest.MockedFunction<
  typeof addToLog
>;

events.defaultMaxListeners = 20;

// Add a timeout helper function
const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise: Promise<never> = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      console.error(
        `TIMEOUT: ${errorMessage || 'Test took too long to complete'}`
      );
      reject(
        new Error(
          `TIMEOUT: ${errorMessage || 'Test took too long to complete'}`
        )
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
};

describe('convertFiles', () => {
  // Save original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getAnswerMock.mockResolvedValue('');
    // Re-enable mocking console output since our tests check for these calls
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });

  // Create a factory function for test files to make tests more maintainable
  const createTestFiles = (count = 2): ConversionItem[] => {
    const files: ConversionItem[] = [];
    for (let i = 0; i < count; i++) {
      files.push({
        inputFile: `C:/Music/testfile${i}.mp3`,
        outputFile: `C:/Music/testfile${i}.ogg`,
        outputFormat: 'ogg',
      });
    }
    return files;
  };

  // Enhanced worker mock factory
  function createWorkerMock({
    exitCode = 0,
    triggerError = false,
    triggerStderr = false,
    noSpaceLeft = false,
    delayCompletion = false,
  } = {}) {
    // Mock events object
    const handlers: WorkerHandlers = {};

    // Create a worker with configurable behavior
    const worker = {
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'message') handlers.message = handler;
        if (event === 'error') handlers.error = handler;
        if (event === 'exit')
          handlers.exit = handler as unknown as (code: number) => void;

        // Don't auto-trigger events if we want to delay completion
        if (delayCompletion) {
          return worker;
        }

        // Synchronously trigger events for test cleanliness
        if (event === 'message' && handlers.message) {
          if (triggerStderr) {
            const errorMessage = noSpaceLeft
              ? 'no space left on device'
              : 'Some error from ffmpeg';
            handlers.message({
              type: 'stderr',
              data: errorMessage,
            });
            return worker;
          }
          handlers.message({ type: 'code', data: exitCode });
        }
        if (event === 'error' && handlers.error && triggerError) {
          handlers.error(new Error('Worker thread error'));
        }
        if (event === 'exit' && handlers.exit) {
          handlers.exit(exitCode);
        }
        return worker;
      }),
      triggerEvents: () => {
        // No-op, since events are now synchronous
      },
    };
    return worker;
  }

  it('should process files successfully', async () => {
    // Create a simple mock worker that auto-completes successfully
    console.log("Starting 'should process files successfully' test");
    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 0 }));

    const result = await withTimeout(
      convertFiles(createTestFiles(2)),
      5000,
      "Test 'should process files successfully' timed out"
    );
    console.log("Test 'should process files successfully' completed");

    expect(workerMock).toHaveBeenCalled();
    expect(result.failedFiles).toHaveLength(0);
    expect(result.successfulFiles.length).toBeGreaterThan(0);
  }, 30000);

  it('should use a single worker for a single file batch', async () => {
    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 0 }));

    const result = await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should use a single worker for a single file batch' timed out"
    );

    expect(workerMock).toHaveBeenCalledTimes(1);
    expect(result.successfulFiles).toHaveLength(1);
    expect(result.failedFiles).toHaveLength(0);
  }, 30000);

  it('should handle failed conversions (non-zero exit code)', async () => {
    // Create a worker that exits with non-zero code
    console.log("Starting 'should handle failed conversions' test");
    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 1 }));

    const result = await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should handle failed conversions' timed out"
    );
    console.log("Test 'should handle failed conversions' completed");

    expect(workerMock).toHaveBeenCalled();
    expect(result.successfulFiles).toHaveLength(0);
    expect(result.failedFiles.length).toBeGreaterThan(0);
    expect(console.error).toHaveBeenCalled();
  }, 30000);

  it('should handle worker errors', async () => {
    // Mock a worker that triggers an error
    console.log("Starting 'should handle worker errors' test");

    workerMock.mockImplementation(() => {
      // Synchronously fire the error event when registered
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') handlers.message = handler;
          if (event === 'error') handlers.error = handler;
          if (event === 'exit')
            handlers.exit = handler as unknown as (code: number) => void;
          if (event === 'error') {
            handler(new Error('Worker thread error'));
          }
          return worker;
        }),
      };
      return worker;
    });

    await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should handle worker errors' timed out"
    );
    console.log("Test 'should handle worker errors' completed");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Worker had an error')
    );
  }, 30000);

  it('should handle stderr messages from workers', async () => {
    // Mock a worker that sends stderr messages
    console.log("Starting 'should handle stderr messages from workers' test");

    workerMock.mockImplementation(() =>
      createWorkerMock({
        triggerStderr: true,
      })
    );

    await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should handle stderr messages from workers' timed out"
    );
    console.log("Test 'should handle stderr messages from workers' completed");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('FFmpeg stderr'),
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
  }, 30000);

  it('should detect disk space errors and exit the process', async () => {
    // Mock a worker that sends a 'no space left' error
    console.log("Starting 'should detect disk space errors' test");

    workerMock.mockImplementation(() =>
      createWorkerMock({
        triggerStderr: true,
        noSpaceLeft: true,
      })
    );

    // Mock process.exit
    const originalExit = process.exit;
    process.exit = jest.fn() as unknown as typeof process.exit;

    await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should detect disk space errors' timed out"
    );
    console.log("Test 'should detect disk space errors' completed");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Stopping due to insufficient disk space')
    );

    // Restore process.exit
    process.exit = originalExit;
  }, 30000);

  it('should abort remaining jobs after a fatal disk-space error mid-batch', async () => {
    cpusMock.mockReturnValueOnce([{}]);
    let workerCalls = 0;

    workerMock.mockImplementation(() => {
      workerCalls++;
      const isFatalJob = workerCalls === 2;
      return createWorkerMock({
        triggerStderr: isFatalJob,
        noSpaceLeft: isFatalJob,
        exitCode: isFatalJob ? 1 : 0,
      });
    });

    const result = await withTimeout(
      convertFiles(createTestFiles(5)),
      10000,
      "Test 'should abort remaining jobs after fatal error' timed out"
    );

    expect(workerCalls).toBeLessThanOrEqual(3);
    expect(result.failedFiles.length).toBeGreaterThan(0);
    expect(result.successfulFiles.length).toBeLessThan(5);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Stopping due to insufficient disk space')
    );
  }, 30000);

  it('should detect permission errors and stop the batch', async () => {
    workerMock.mockImplementation(() => {
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') handlers.message = handler;
          if (event === 'error') handlers.error = handler;
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (event === 'message' && handlers.message) {
            handlers.message({
              type: 'stderr',
              data: 'Permission denied while opening output file',
            });
          }

          if (event === 'exit' && handlers.exit) {
            handlers.exit(1);
          }

          return worker;
        }),
      };
      return worker;
    });

    const result = await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should detect permission errors and stop the batch' timed out"
    );

    expect(result.failedFiles).toHaveLength(1);
    expect(result.successfulFiles).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Stopping due to file permission/access error')
    );
  }, 30000);

  it('should prompt multiple times when concurrent workers hit fatal errors together', async () => {
    cpusMock.mockReturnValueOnce([{}, {}]);

    const queuedWorkers: Array<{
      emitFatal: () => void;
      emitExit: () => void;
    }> = [];
    let released = false;

    workerMock.mockImplementation(() => {
      const handlers: WorkerHandlers = {};
      const queuedWorker = {
        emitFatal: () => {
          handlers.message?.({
            type: 'stderr',
            data: 'no space left on device',
          });
        },
        emitExit: () => {
          handlers.exit?.(1);
        },
      };
      queuedWorkers.push(queuedWorker);

      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') handlers.message = handler;
          if (event === 'error') handlers.error = handler;
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (!released && queuedWorkers.length === 2) {
            released = true;
            Promise.resolve().then(() => {
              for (const activeWorker of queuedWorkers) {
                activeWorker.emitFatal();
                activeWorker.emitExit();
              }
            });
          }

          return worker;
        }),
      };

      return worker;
    });

    const result = await withTimeout(
      convertFiles(createTestFiles(2)),
      5000,
      "Test 'should prompt multiple times when concurrent workers hit fatal errors together' timed out"
    );

    expect(getAnswerMock).toHaveBeenCalledTimes(2);
    expect(getAnswerMock).toHaveBeenNthCalledWith(
      1,
      'Press ENTER to return to the main menu...'
    );
    expect(getAnswerMock).toHaveBeenNthCalledWith(
      2,
      'Press ENTER to return to the main menu...'
    );
    expect(result.failedFiles).toHaveLength(2);
  }, 30000);

  it('should handle multiple workers and files properly', async () => {
    // Create a mix of successful and failing workers
    console.log(
      "Starting 'should handle multiple workers and files properly' test"
    );

    let callCount = 0;
    workerMock.mockImplementation(() => {
      callCount++;
      return createWorkerMock({
        exitCode: callCount % 2 === 0 ? 0 : 1,
      });
    });

    const result = await withTimeout(
      convertFiles(createTestFiles(4)),
      5000,
      "Test 'should handle multiple workers and files' timed out"
    );
    console.log(
      "Test 'should handle multiple workers and files properly' completed"
    );

    expect(workerMock).toHaveBeenCalledTimes(4);
    expect(result.successfulFiles.length).toBeGreaterThan(0);
    expect(result.failedFiles.length).toBeGreaterThan(0);
  }, 30000);

  it('should return exact success and failure counts for a mixed batch', async () => {
    const exitCodes = [0, 1, 0];
    workerMock.mockImplementation(() =>
      createWorkerMock({ exitCode: exitCodes.shift() ?? 0 })
    );

    const result = await withTimeout(
      convertFiles(createTestFiles(3)),
      5000,
      "Test 'should return exact success and failure counts' timed out"
    );

    expect(result.successfulFiles).toHaveLength(2);
    expect(result.failedFiles).toHaveLength(1);
  }, 30000);

  it('should not mutate the input conversion list', async () => {
    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 0 }));

    const files = createTestFiles(2);
    const snapshot = [...files];

    await withTimeout(
      convertFiles(files),
      5000,
      "Test 'should not mutate the input conversion list' timed out"
    );

    expect(files).toEqual(snapshot);
  }, 30000);

  it('should call addToLog for both successful and failed conversions', async () => {
    const exitCodes = [0, 1];
    workerMock.mockImplementation(() =>
      createWorkerMock({ exitCode: exitCodes.shift() ?? 0 })
    );

    await withTimeout(
      convertFiles(createTestFiles(2)),
      5000,
      "Test 'should call addToLog for both successful and failed conversions' timed out"
    );

    expect(addToLogMock).toHaveBeenCalledTimes(2);
    expect(addToLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'code', data: 0 }),
      expect.objectContaining({ outputFile: expect.stringContaining('.ogg') })
    );
    expect(addToLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
      expect.objectContaining({ outputFile: expect.stringContaining('.ogg') })
    );
  }, 30000);

  // Test for CPU count fallback
  it('should handle CPU detection failure', async () => {
    // Mock os.cpus to throw an error
    console.log("Starting 'should handle CPU detection failure' test");

    cpusMock.mockImplementationOnce(() => {
      throw new Error('CPU detection failed');
    });

    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 0 }));

    const result = await withTimeout(
      convertFiles(createTestFiles(2)),
      5000,
      "Test 'should handle CPU detection failure' timed out"
    );
    console.log("Test 'should handle CPU detection failure' completed");

    // Update to match the actual format of the warning
    expect(console.warn).toHaveBeenCalledWith(
      '🚨🚨⛔ Could not detect amount of CPU cores!!! Setting to 8 ⛔🚨🚨'
    );
    expect(result.failedFiles).toHaveLength(0);
  }, 30000);

  it('should limit concurrent workers based on CPU count and file count', async () => {
    // Set up 10 CPUs but only 2 files
    console.log("Starting 'should limit concurrent workers' test");

    cpusMock.mockReturnValueOnce(Array(10).fill({}));
    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 0 }));

    await withTimeout(
      convertFiles(createTestFiles(2)),
      5000,
      "Test 'should limit concurrent workers' timed out"
    );
    console.log("Test 'should limit concurrent workers' completed");

    expect(workerMock).toHaveBeenCalledTimes(2); // Should create only 2 workers
  }, 30000);

  it('should properly handle worker creation errors', async () => {
    // Mock Worker constructor to throw an error
    console.log(
      "Starting 'should properly handle worker creation errors' test"
    );

    workerMock.mockImplementationOnce(() => {
      throw new Error('Failed to create worker');
    });

    // Should not throw but log the error
    await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should properly handle worker creation errors' timed out"
    );
    console.log(
      "Test 'should properly handle worker creation errors' completed"
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error creating worker')
    );
  }, 30000);

  it('should handle an empty file list', async () => {
    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 0 }));
    const result = await withTimeout(
      convertFiles([]),
      5000,
      "Test 'should handle empty file list' timed out"
    );
    expect(result.failedFiles).toHaveLength(0);
    expect(result.successfulFiles).toHaveLength(0);
  });

  it('should handle file with missing properties gracefully', async () => {
    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 0 }));
    const files = [
      { inputFile: undefined, outputFile: undefined, outputFormat: undefined },
    ] as unknown as ConversionItem[];
    const result = await withTimeout(
      convertFiles(files),
      5000,
      "Test 'should handle file with missing properties' timed out"
    );
    expect(result.failedFiles.length + result.successfulFiles.length).toBe(1);
  });

  it('should put all files in failedFiles if all workers fail', async () => {
    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 1 }));
    const files = createTestFiles(3);
    const result = await withTimeout(
      convertFiles(files),
      5000,
      "Test 'should put all files in failedFiles' timed out"
    );
    expect(result.failedFiles.length).toBe(3);
    expect(result.successfulFiles).toHaveLength(0);
  });

  it('should return all files as successful when every worker exits cleanly', async () => {
    workerMock.mockImplementation(() => createWorkerMock({ exitCode: 0 }));

    const result = await withTimeout(
      convertFiles(createTestFiles(3)),
      5000,
      "Test 'should return all files as successful when every worker exits cleanly' timed out"
    );

    expect(result.successfulFiles).toHaveLength(3);
    expect(result.failedFiles).toHaveLength(0);
  });

  it('should not treat harmless stderr containing the word space as fatal disk-space error', async () => {
    workerMock.mockImplementation(() => {
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') handlers.message = handler;
          if (event === 'error') handlers.error = handler;
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (event === 'message' && handlers.message) {
            handlers.message({
              type: 'stderr',
              data: 'Using color space conversion matrix',
            });
            handlers.message({ type: 'code', data: 0 });
          }

          if (event === 'exit' && handlers.exit) {
            handlers.exit(0);
          }

          return worker;
        }),
      };
      return worker;
    });

    const result = await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should not treat harmless stderr as fatal' timed out"
    );

    expect(result.successfulFiles).toHaveLength(1);
    expect(result.failedFiles).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Stopping due to insufficient disk space')
    );
  });

  it('should not record the same failed file twice when error and exit both fire', async () => {
    workerMock.mockImplementation(() => {
      const handlers: WorkerHandlers = {};
      const worker = {
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'message') handlers.message = handler;
          if (event === 'error') handlers.error = handler;
          if (event === 'exit') {
            handlers.exit = handler as unknown as (code: number) => void;
          }

          if (event === 'error' && handlers.error) {
            handlers.error(new Error('Worker thread error'));
          }

          if (event === 'exit' && handlers.exit) {
            handlers.exit(1);
          }

          return worker;
        }),
      };
      return worker;
    });

    const result = await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should deduplicate failed file recording' timed out"
    );

    expect(result.failedFiles).toHaveLength(1);
    expect(result.successfulFiles).toHaveLength(0);
  });

  it('processes queued files in LIFO order when a single worker is available', async () => {
    cpusMock.mockReturnValueOnce([{}]);
    const processedInputs: string[] = [];

    workerMock.mockImplementation(
      (_path: string, options: { workerData: { file: ConversionItem } }) => {
        processedInputs.push(options.workerData.file.inputFile);
        return createWorkerMock({ exitCode: 0 });
      }
    );

    const files = createTestFiles(6);
    await withTimeout(
      convertFiles(files),
      5000,
      "Test 'LIFO queue order' timed out"
    );

    expect(processedInputs).toEqual([
      files[5].inputFile,
      files[4].inputFile,
      files[3].inputFile,
      files[2].inputFile,
      files[1].inputFile,
      files[0].inputFile,
    ]);
  });
});
