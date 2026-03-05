import { jest, describe, it, expect, afterEach } from '@jest/globals';

type Config = {
  sep: '/' | '\\';
  runtimeBaseDir: string;
  platformSlug: 'windows' | 'linux' | 'macos';
  exists: Set<string>;
};

let config: Config = {
  sep: '/',
  runtimeBaseDir: '/app',
  platformSlug: 'linux',
  exists: new Set<string>(),
};

const spawnSyncMock = jest.fn(() => ({
  stdout: JSON.stringify({ streams: [], format: {} }),
  stderr: '',
  status: 0,
  error: null,
}));

jest.unstable_mockModule('child_process', () => ({
  spawnSync: spawnSyncMock,
}));

jest.unstable_mockModule('path', () => ({
  join: (...parts: string[]) => parts.join(config.sep),
}));

jest.unstable_mockModule('fs', () => ({
  existsSync: (p: string) => config.exists.has(p),
}));

jest.unstable_mockModule('../utils.js', () => ({
  get runtimeBaseDir() {
    return config.runtimeBaseDir;
  },
  get platformSlug() {
    return config.platformSlug;
  },
  findBinary: (name: string, subdirs: string[] = []) => {
    const sep = config.sep;
    const roots = [config.runtimeBaseDir];
    for (const root of roots) {
      const direct = [root, name].join(sep);
      if (config.exists.has(direct)) return direct;
      for (const sub of subdirs) {
        const candidate = [root, sub, name].join(sep);
        if (config.exists.has(candidate)) return candidate;
      }
    }
    try {
      const cwd = process.cwd();
      const direct = [cwd, name].join(sep);
      if (config.exists.has(direct)) return direct;
      for (const sub of subdirs) {
        const candidate = [cwd, sub, name].join(sep);
        if (config.exists.has(candidate)) return candidate;
      }
    } catch {
      /* ignore */
    }
    return null;
  },
}));

const importSubject = async () => {
  jest.resetModules();
  return await import('../metadataService.js');
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('metadataService ffprobe path resolution', () => {
  it('uses ffprobe.exe on windows from runtimeBaseDir', async () => {
    config = {
      sep: '\\',
      runtimeBaseDir: 'C:\\app',
      platformSlug: 'windows',
      exists: new Set<string>(['C:\\app\\ffprobe.exe']),
    };

    const { getMetaData } = await importSubject();
    await getMetaData('C:\\in\\in.mp3');

    expect(spawnSyncMock).toHaveBeenCalled();
    expect((spawnSyncMock.mock.calls as any[][])[0][0]).toBe(
      'C:\\app\\ffprobe.exe'
    );
  }, 10000);

  it('uses ffmpeg-bin/<platformSlug>/ffprobe on linux when present', async () => {
    config = {
      sep: '/',
      runtimeBaseDir: '/app',
      platformSlug: 'linux',
      exists: new Set<string>(['/app/ffmpeg-bin/linux/ffprobe']),
    };

    const { getMetaData } = await importSubject();
    await getMetaData('/in/in.mp3');

    expect(spawnSyncMock).toHaveBeenCalled();
    expect((spawnSyncMock.mock.calls as any[][])[0][0]).toBe(
      '/app/ffmpeg-bin/linux/ffprobe'
    );
  }, 10000);

  it('returns null when no ffprobe candidates exist', async () => {
    config = {
      sep: '/',
      runtimeBaseDir: '/app',
      platformSlug: 'linux',
      exists: new Set<string>(),
    };

    const { getMetaData } = await importSubject();
    const result = await getMetaData('/in/in.mp3');

    // No ffprobe found, spawnSync never called, returns null
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  }, 10000);
});
