import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { LoopDataMode } from '../types/settings.js';

const postMessageMock = jest.fn();
const formatLoopDataMock = jest
  .fn()
  .mockReturnValue([
    '-metadata',
    'LOOPSTART=100',
    '-metadata',
    'LOOPLENGTH=500',
  ]);
const convertLoopPointsMock = jest.fn().mockReturnValue({
  newSampleRate: null,
  loopStart: 100,
  loopLength: 500,
});

jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('worker_threads', () => ({
  parentPort: { postMessage: postMessageMock },
  workerData: {},
}));

jest.unstable_mockModule('../utils.js', () => ({
  runtimeBaseDir: '/app',
  isPackagedRuntime: false,
  platformSlug: 'windows',
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error || 'Unknown error'),
  findBinary: () => '/app/ffmpeg.exe',
}));

jest.unstable_mockModule('../metadataService.js', () => ({
  getMetaData: jest.fn().mockResolvedValue({
    streams: [
      {
        sample_rate: '44100',
        channels: 2,
        tags: { LOOPSTART: '100', LOOPLENGTH: '500' },
      },
    ],
    format: { tags: {} },
  }),
  formatMetaDataArgs: jest.fn().mockReturnValue({
    metaDataArgs: [],
    channelsArgs: ['-ac', '2'],
  }),
  convertLoopPoints: (...args: unknown[]) => convertLoopPointsMock(...args),
  formatLoopData: (...args: unknown[]) => formatLoopDataMock(...args),
}));

jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn(() => {
    const mockProcess = {
      on: jest.fn((event: string, callback: (code: number) => void) => {
        if (event === 'exit') setTimeout(() => callback(0), 0);
        return mockProcess;
      }),
      stderr: { on: jest.fn() },
    };
    return mockProcess;
  }),
}));

const { converterWorker } = await import('../converterWorker.js');
const { spawn } = await import('child_process');
const spawnMock = spawn as unknown as jest.Mock;

describe('loopDataMode audit (KB-003 fixed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    formatLoopDataMock.mockReturnValue([
      '-metadata',
      'LOOPSTART=100',
      '-metadata',
      'LOOPLENGTH=500',
    ]);
    convertLoopPointsMock.mockReturnValue({
      newSampleRate: null,
      loopStart: 100,
      loopLength: 500,
    });
  });

  it('auto mode skips loop metadata on unsupported WAV output', async () => {
    await converterWorker({
      file: {
        inputFile: 'in.mp3',
        outputFile: 'out.wav',
        outputFormat: 'wav',
      },
      settings: { oggCodec: 'vorbis', loopDataMode: 'auto' },
    });

    const args = spawnMock.mock.calls[0]?.[1] as string[] | undefined;
    expect(args).toBeDefined();
    expect(args).not.toEqual(
      expect.arrayContaining(['-metadata', 'LOOPSTART=100'])
    );
    expect(formatLoopDataMock).not.toHaveBeenCalled();
  });

  it('force mode writes loop metadata even on unsupported WAV output', async () => {
    const forceMode: LoopDataMode = 'force';

    await converterWorker({
      file: {
        inputFile: 'in.mp3',
        outputFile: 'out.wav',
        outputFormat: 'wav',
      },
      settings: { oggCodec: 'vorbis', loopDataMode: forceMode },
    });

    const args = spawnMock.mock.calls[0]?.[1] as string[] | undefined;
    expect(args).toBeDefined();
    expect(args).toEqual(
      expect.arrayContaining(['-metadata', 'LOOPSTART=100'])
    );
    expect(formatLoopDataMock).toHaveBeenCalled();
  });
});
