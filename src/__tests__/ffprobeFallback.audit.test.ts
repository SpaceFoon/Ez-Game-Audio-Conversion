import { jest, describe, it, expect, beforeEach } from '@jest/globals';

let capturedSpawnArgs: string[] = [];

jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => {
    if (path.includes('ffmpeg')) return true;
    if (path.includes('ffprobe')) return true;
    if (path.includes('input')) return true;
    return false;
  }),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

jest.unstable_mockModule('worker_threads', () => ({
  parentPort: { postMessage: jest.fn() },
  workerData: {},
}));

jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn((_command: string, args: string[]) => {
    capturedSpawnArgs = [...args];
    const mockProcess = {
      on: jest.fn((event: string, callback: (code: number) => void) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 0);
        }
        return mockProcess;
      }),
      stderr: {
        on: jest.fn(),
      },
    };
    return mockProcess;
  }),
  spawnSync: jest.fn(() => ({
    stdout: '',
    stderr: 'ffprobe failed',
    status: 1,
    error: undefined,
  })),
}));

jest.unstable_mockModule('../utils.js', () => ({
  runtimeBaseDir: '/app',
  isPackagedRuntime: false,
  platformSlug: 'windows',
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error || 'Unknown error'),
  findBinary: (name: string) =>
    name.includes('ffprobe') ? '/app/ffprobe.exe' : '/app/ffmpeg.exe',
  addToLog: jest.fn(),
}));

const { converterWorker } = await import('../converterWorker.js');
const { parentPort } = await import('worker_threads');

describe('ffprobe fallback audit (KB-001 fixed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSpawnArgs = [];
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  it('fails conversion when ffprobe cannot read input metadata', async () => {
    await expect(
      converterWorker({
        file: {
          inputFile: '/input/mono-source.wav',
          outputFile: '/output/result.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      })
    ).rejects.toThrow(/ffprobe failed/i);

    expect(capturedSpawnArgs).toEqual([]);
    expect(parentPort!.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        data: expect.stringMatching(/ffprobe failed/i),
      })
    );
  });
});
