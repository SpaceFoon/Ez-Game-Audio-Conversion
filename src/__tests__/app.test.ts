import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import type { Mock } from 'jest-mock';

// ESM mocks must be declared BEFORE dynamic imports
jest.unstable_mockModule('../getUserInput.js', () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule('../searchFiles.js', () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule('../createConversionList.js', () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule('../convertFiles.js', () => ({
  convertFiles: jest.fn(),
}));

jest.unstable_mockModule('../finalize.js', () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule('cfonts', () => ({
  default: { say: jest.fn() },
  say: jest.fn(),
}));

jest.unstable_mockModule('os', () => ({
  default: {
    platform: jest.fn(() => 'win32'),
    arch: jest.fn(() => 'x64'),
    cpus: jest.fn(() => [1, 2, 3, 4]),
    release: jest.fn(() => 'test'),
  },
  platform: jest.fn(() => 'win32'),
  arch: jest.fn(() => 'x64'),
  cpus: jest.fn(() => [1, 2, 3, 4]),
  release: jest.fn(() => 'test'),
}));

jest.unstable_mockModule('dotenv', () => ({
  default: { config: jest.fn() },
  config: jest.fn(),
}));

// Dynamic imports after mock declarations
const { default: getUserInput } = await import('../getUserInput.js');
const { default: searchFiles } = await import('../searchFiles.js');
const { default: createConversionList } = await import('../createConversionList.js');
const { convertFiles } = await import('../convertFiles.js');
const { default: finalize } = await import('../finalize.js');
const { default: runApp } = await import('../app.js');

describe('app.js', () => {
  let originalEnv: typeof globalThis.env | undefined;
  let logSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = globalThis.env;

    // Default mock implementations
    (getUserInput as Mock).mockResolvedValue({});
    (searchFiles as Mock).mockResolvedValue(['file1']);
    (createConversionList as Mock).mockResolvedValue(['file2']);
    (convertFiles as Mock).mockResolvedValue({
      failedFiles: [],
      successfulFiles: ['file2'],
      jobStartTime: 0,
    });
    (finalize as Mock).mockResolvedValue(undefined);

    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.env = originalEnv!;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('runs the happy path (all promises resolve)', async () => {
    await runApp();

    expect(getUserInput).toHaveBeenCalled();
    expect(searchFiles).toHaveBeenCalled();
    expect(createConversionList).toHaveBeenCalled();
    expect(convertFiles).toHaveBeenCalled();
    expect(finalize).toHaveBeenCalled();
  });

  it('handles errors in the promise chain', async () => {
    (getUserInput as Mock).mockRejectedValue(new Error('fail'));

    await runApp();

    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not reinitialize globalThis.env if already set', async () => {
    (globalThis as Record<string, unknown>).env = { already: true };

    await runApp();

    expect(globalThis.env).toEqual({ already: true });
  });

  // Skip: process.stdin/stdout are read-only getters in Node 20+
  it.skip('logs debug mode and TTY info if env.isDebug is true', async () => {
    globalThis.env = {
      isDebug: true,
      isDev: false,
      isPkg: false,
      isWindows: true,
      isMac: false,
      isLinux: false,
      arch: 'x64',
      platform: 'win32',
      cpuCount: 4,
    };

    await runApp();

    expect(logSpy).toHaveBeenCalledWith('debug mode');
    expect(logSpy).toHaveBeenCalledWith('stdin is TTY:', true);
    expect(logSpy).toHaveBeenCalledWith('stdout is TTY:', true);
  });

  it('logs dev mode if env.isDev is true', async () => {
    globalThis.env = {
      isDebug: false,
      isDev: true,
      isPkg: false,
      isWindows: true,
      isMac: false,
      isLinux: false,
      arch: 'x64',
      platform: 'win32',
      cpuCount: 4,
    };

    await runApp();

    expect(logSpy).toHaveBeenCalledWith('in dev mode');
  });

  it('writes to process.stdout for terminal title', async () => {
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runApp();

    expect(writeSpy).toHaveBeenCalledWith('\x1b]0;EZ Game Audio\x1b\x5c');
    expect(writeSpy).toHaveBeenCalledWith('\x1b]2;EZ Game Audio\x1b\x5c');

    writeSpy.mockRestore();
  });
});
