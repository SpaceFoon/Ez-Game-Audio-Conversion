import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const postMessageMock = jest.fn();
const spawnMock = jest.fn();

jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => {
    if (String(path).includes('ffmpeg')) return true;
    if (String(path).includes('ffprobe')) return true;
    if (String(path).includes('input')) return true;
    return false;
  }),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

jest.unstable_mockModule('worker_threads', () => ({
  parentPort: { postMessage: postMessageMock },
  workerData: {},
}));

jest.unstable_mockModule('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
  spawnSync: jest.fn(() => ({
    stdout: JSON.stringify({
      streams: [{ sample_rate: '44100', channels: 2, tags: {} }],
      format: { tags: {} },
    }),
    stderr: '',
    status: 0,
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

describe('stderr IPC audit (KB-002 fixed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    spawnMock.mockImplementation(() => {
      const mockProcess = {
        on: jest.fn((event: string, callback: (code: number) => void) => {
          if (event === 'exit') setTimeout(() => callback(0), 0);
          return mockProcess;
        }),
        stderr: {
          on: jest.fn((event: string, callback: (buf: Buffer) => void) => {
            if (event === 'data') {
              callback(Buffer.from('no space left on device'));
            }
            return mockProcess.stderr;
          }),
        },
      };
      return mockProcess;
    });
  });

  it('streams ffmpeg stderr chunks to the parent during execution', async () => {
    await converterWorker({
      file: {
        inputFile: '/app/input/song.wav',
        outputFile: '/app/output/song.mp3',
        outputFormat: 'mp3',
      },
      settings: { oggCodec: 'vorbis' },
    });

    expect(postMessageMock).toHaveBeenCalledWith({
      type: 'stderr',
      data: 'no space left on device',
    });
    expect(postMessageMock).toHaveBeenCalledWith({ type: 'code', data: 0 });
  });

  it('does not post stderr messages when ffmpeg produces no stderr output', async () => {
    spawnMock.mockImplementation(() => {
      const mockProcess = {
        on: jest.fn((event: string, callback: (code: number) => void) => {
          if (event === 'exit') setTimeout(() => callback(0), 0);
          return mockProcess;
        }),
        stderr: { on: jest.fn() },
      };
      return mockProcess;
    });

    await converterWorker({
      file: {
        inputFile: '/app/input/song.wav',
        outputFile: '/app/output/song.mp3',
        outputFormat: 'mp3',
      },
      settings: { oggCodec: 'vorbis' },
    });

    const stderrMessages = postMessageMock.mock.calls.filter(
      ([message]) =>
        message &&
        typeof message === 'object' &&
        (message as { type?: string }).type === 'stderr'
    );
    expect(stderrMessages).toHaveLength(0);
  });
});
