import { jest } from '@jest/globals';

export type SpawnCall = {
  command: string;
  args: string[];
};

/**
 * Build a child_process.spawn mock that records argv arrays for ffmpeg/ffprobe tests.
 */
export const createSpawnCaptureMock = () => {
  const calls: SpawnCall[] = [];

  const spawnMock = jest.fn((command: string, args: string[]) => {
    calls.push({ command, args: [...args] });

    const stdoutHandlers: Array<(chunk: Buffer) => void> = [];
    const stderrHandlers: Array<(chunk: Buffer) => void> = [];
    const closeHandlers: Array<(code: number) => void> = [];

    const proc = {
      stdout: {
        on: jest.fn((event: string, handler: (chunk: Buffer) => void) => {
          if (event === 'data') stdoutHandlers.push(handler);
        }),
      },
      stderr: {
        on: jest.fn((event: string, handler: (chunk: Buffer) => void) => {
          if (event === 'data') stderrHandlers.push(handler);
        }),
      },
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'close') {
          closeHandlers.push(handler as (code: number) => void);
        }
      }),
      emitStdout: (data: string) => {
        const chunk = Buffer.from(data);
        stdoutHandlers.forEach((h) => h(chunk));
      },
      emitStderr: (data: string) => {
        const chunk = Buffer.from(data);
        stderrHandlers.forEach((h) => h(chunk));
      },
      emitClose: (code: number) => {
        closeHandlers.forEach((h) => h(code));
      },
    };

    return proc;
  });

  return { spawnMock, calls };
};
