import { jest } from '@jest/globals';

export type WorkerHandlers = {
  message?: (message: unknown) => void;
  error?: (error: unknown) => void;
  exit?: (code: number) => void;
};

export type MockWorkerOptions = {
  exitCode?: number;
  triggerError?: boolean;
  triggerStderr?: boolean;
  noSpaceLeft?: boolean;
  delayCompletion?: boolean;
  /** If set, skip auto-firing message/exit events when handlers register */
  manual?: boolean;
};

/**
 * Factory for worker_threads.Worker mocks with controllable message/exit ordering.
 */
export const createMockWorker = (options: MockWorkerOptions = {}) => {
  const {
    exitCode = 0,
    triggerError = false,
    triggerStderr = false,
    noSpaceLeft = false,
    delayCompletion = false,
    manual = false,
  } = options;

  const handlers: WorkerHandlers = {};

  const worker = {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'message') handlers.message = handler;
      if (event === 'error') handlers.error = handler;
      if (event === 'exit') {
        handlers.exit = handler as unknown as (code: number) => void;
      }

      if (manual || delayCompletion) {
        return worker;
      }

      if (event === 'message' && handlers.message) {
        if (triggerStderr) {
          const errorMessage = noSpaceLeft
            ? 'no space left on device'
            : 'Some error from ffmpeg';
          handlers.message({
            type: 'stderr',
            data: errorMessage,
          });
        }
        if (!triggerError && exitCode === 0) {
          handlers.message({ type: 'code', data: 0 });
        }
      }

      if (event === 'error' && triggerError && handlers.error) {
        handlers.error(new Error('Worker thread error'));
      }

      if (event === 'exit' && handlers.exit && !triggerError) {
        handlers.exit(exitCode);
      }

      return worker;
    }),
    emitMessage: (message: unknown) => {
      if (handlers.message) handlers.message(message);
    },
    emitExit: (code: number) => {
      if (handlers.exit) handlers.exit(code);
    },
    emitError: (error: Error) => {
      if (handlers.error) handlers.error(error);
    },
  };

  return worker;
};
