import { jest, describe, it, expect, afterEach } from '@jest/globals';

type Config = {
  sep: '/' | '\\';
  runtimeBaseDir: string;
  platformSlug: 'windows' | 'linux' | 'macos';
  isPackagedRuntime: boolean;
  exists: Set<string>;
};

let config: Config = {
  sep: '/',
  runtimeBaseDir: '/app',
  platformSlug: 'linux',
  isPackagedRuntime: false,
  exists: new Set<string>(),
};

const spawnMock = jest.fn(() => {
  const mockProc: any = {
    stderr: { on: jest.fn() },
    on: jest.fn((event: string, cb: (code: number) => void) => {
      if (event === 'exit') cb(0);
      return mockProc;
    }),
  };
  return mockProc;
});

const makeDirname = (sep: '/' | '\\') => (p: string) => {
  const idx = p.lastIndexOf(sep);
  if (idx <= 0) return '';
  return p.slice(0, idx);
};

jest.unstable_mockModule('worker_threads', () => ({
  parentPort: null,
  workerData: null,
}));

jest.unstable_mockModule('child_process', () => ({
  spawn: spawnMock,
}));

jest.unstable_mockModule('path', () => ({
  join: (...parts: string[]) => parts.join(config.sep),
  dirname: (p: string) => makeDirname(config.sep)(p),
}));

jest.unstable_mockModule('fs', () => ({
  existsSync: (p: string) => config.exists.has(p),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('../utils.js', () => ({
  get runtimeBaseDir() {
    return config.runtimeBaseDir;
  },
  get platformSlug() {
    return config.platformSlug;
  },
  get isPackagedRuntime() {
    return config.isPackagedRuntime;
  },
}));

jest.unstable_mockModule('../metadataService.js', () => ({
  getMetaData: jest.fn(async () => null),
  formatMetaDataArgs: jest.fn(() => ({ metaDataArgs: [], channelsArgs: [] })),
  convertLoopPoints: jest.fn(() => ({
    newSampleRate: null,
    loopStart: NaN,
    loopLength: NaN,
  })),
  formatLoopData: jest.fn(() => ''),
  formatMetaData: jest.fn(() => ({ metaData: '', channels: ' -ac 2' })),
}));

afterEach(() => {
  jest.clearAllMocks();
});

describe('converterWorker ffmpeg path resolution', () => {
  it('uses runtimeBaseDir ffmpeg-bin on linux (dev)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const outputFile = '/out/out.mp3';

    config = {
      sep: '/',
      runtimeBaseDir: '/app',
      platformSlug: 'linux',
      isPackagedRuntime: false,
      exists: new Set<string>(['/out', '/app/ffmpeg-bin/linux/ffmpeg']),
    };

    jest.resetModules();
    const { converterWorker } = await import('../converterWorker.js');

    await converterWorker({
      file: {
        inputFile: '/in/in.wav',
        outputFile,
        outputFormat: 'mp3',
      },
      settings: { oggCodec: 'vorbis' },
    });

    expect(spawnMock).toHaveBeenCalled();
    expect((spawnMock.mock.calls as any[][])[0][0]).toBe(
      '/app/ffmpeg-bin/linux/ffmpeg'
    );

    process.env.NODE_ENV = originalEnv;
  }, 10000);

  it('uses runtimeBaseDir ffmpeg.exe on windows (packaged)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const outputFile = 'C:\\out\\out.mp3';

    config = {
      sep: '\\',
      runtimeBaseDir: 'C:\\app',
      platformSlug: 'windows',
      isPackagedRuntime: true,
      exists: new Set<string>(['C:\\out', 'C:\\app\\ffmpeg.exe']),
    };

    jest.resetModules();
    const { converterWorker } = await import('../converterWorker.js');

    await converterWorker({
      file: {
        inputFile: 'C:\\in\\in.wav',
        outputFile,
        outputFormat: 'mp3',
      },
      settings: { oggCodec: 'vorbis' },
    });

    expect(spawnMock).toHaveBeenCalled();
    expect((spawnMock.mock.calls as any[][])[0][0]).toBe('C:\\app\\ffmpeg.exe');

    process.env.NODE_ENV = originalEnv;
  }, 10000);

  it('throws in packaged+production when only PATH fallback is available (linux)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const outputFile = '/out/out.mp3';

    config = {
      sep: '/',
      runtimeBaseDir: '/app',
      platformSlug: 'linux',
      isPackagedRuntime: true,
      exists: new Set<string>(['/out']),
    };

    jest.resetModules();
    const { converterWorker } = await import('../converterWorker.js');

    await expect(
      converterWorker({
        file: {
          inputFile: '/in/in.wav',
          outputFile,
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      })
    ).rejects.toThrow(/ffmpeg not found/);

    process.env.NODE_ENV = originalEnv;
  }, 10000);

  it('allows PATH fallback outside production (packaged linux)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const outputFile = '/out/out.mp3';

    config = {
      sep: '/',
      runtimeBaseDir: '/app',
      platformSlug: 'linux',
      isPackagedRuntime: true,
      exists: new Set<string>(['/out']),
    };

    jest.resetModules();
    const { converterWorker } = await import('../converterWorker.js');

    await converterWorker({
      file: {
        inputFile: '/in/in.wav',
        outputFile,
        outputFormat: 'mp3',
      },
      settings: { oggCodec: 'vorbis' },
    });

    expect(spawnMock).toHaveBeenCalled();
    expect((spawnMock.mock.calls as any[][])[0][0]).toBe('ffmpeg');

    process.env.NODE_ENV = originalEnv;
  }, 10000);
});
