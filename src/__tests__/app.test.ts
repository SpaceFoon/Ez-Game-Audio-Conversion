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

jest.unstable_mockModule('../converterManager.js', () => ({
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
const { default: createConversionList } =
  await import('../createConversionList.js');
const { convertFiles } = await import('../converterManager.js');
const { default: finalize } = await import('../finalize.js');
const { default: ExitProgramError } = await import('../exitProgramError.js');
const { default: runApp } = await import('../app.js');

describe('app.js', () => {
  let originalEnv: typeof globalThis.env | undefined;
  let logSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = globalThis.env;

    // Default mock implementations - cast through unknown to avoid strict type checking
    (getUserInput as unknown as Mock<() => Promise<object>>).mockResolvedValue(
      {}
    );
    (searchFiles as unknown as Mock<() => Promise<string[]>>).mockResolvedValue(
      ['file1']
    );
    (
      createConversionList as unknown as Mock<() => Promise<string[]>>
    ).mockResolvedValue(['file2']);
    (convertFiles as unknown as Mock<() => Promise<object>>).mockResolvedValue({
      failedFiles: [],
      successfulFiles: ['file2'],
      jobStartTime: 0,
    });
    (finalize as unknown as Mock<() => Promise<boolean>>).mockResolvedValue(
      false
    );

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

  it('continues after ExitProgramError and stops when finalize returns false', async () => {
    (
      getUserInput as unknown as Mock<() => Promise<object>>
    ).mockRejectedValueOnce(new ExitProgramError('EXIT_PROGRAM:1'));

    await runApp();

    expect(getUserInput).toHaveBeenCalledTimes(2);
    expect(searchFiles).toHaveBeenCalledTimes(1);
    expect(createConversionList).toHaveBeenCalledTimes(1);
    expect(convertFiles).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('repeats the pipeline while finalize returns true', async () => {
    (finalize as unknown as Mock<() => Promise<boolean>>)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await runApp();

    expect(getUserInput).toHaveBeenCalledTimes(3);
    expect(searchFiles).toHaveBeenCalledTimes(3);
    expect(createConversionList).toHaveBeenCalledTimes(3);
    expect(convertFiles).toHaveBeenCalledTimes(3);
    expect(finalize).toHaveBeenCalledTimes(3);
  });

  it('handles errors in the promise chain', async () => {
    (getUserInput as unknown as Mock<() => Promise<never>>).mockRejectedValue(
      new Error('fail')
    );

    await runApp();

    expect(errorSpy).toHaveBeenCalled();
  });

  it('logs a fatal error and stops when searchFiles fails', async () => {
    const fatalError = new Error('search failed');
    (
      searchFiles as unknown as Mock<() => Promise<never>>
    ).mockRejectedValueOnce(fatalError);

    await runApp();

    expect(getUserInput).toHaveBeenCalledTimes(1);
    expect(searchFiles).toHaveBeenCalledTimes(1);
    expect(createConversionList).not.toHaveBeenCalled();
    expect(convertFiles).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Fatal Error', fatalError);
  });

  it('logs a fatal error and stops when convertFiles fails', async () => {
    const fatalError = new Error('convert failed');
    (
      convertFiles as unknown as Mock<() => Promise<never>>
    ).mockRejectedValueOnce(fatalError);

    await runApp();

    expect(getUserInput).toHaveBeenCalledTimes(1);
    expect(searchFiles).toHaveBeenCalledTimes(1);
    expect(createConversionList).toHaveBeenCalledTimes(1);
    expect(convertFiles).toHaveBeenCalledTimes(1);
    expect(finalize).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Fatal Error', fatalError);
  });

  it('logs a fatal error and stops when createConversionList fails', async () => {
    const fatalError = new Error('list failed');
    (
      createConversionList as unknown as Mock<() => Promise<never>>
    ).mockRejectedValueOnce(fatalError);

    await runApp();

    expect(getUserInput).toHaveBeenCalledTimes(1);
    expect(searchFiles).toHaveBeenCalledTimes(1);
    expect(createConversionList).toHaveBeenCalledTimes(1);
    expect(convertFiles).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Fatal Error', fatalError);
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
    const writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runApp();

    expect(writeSpy).toHaveBeenCalledWith('\x1b]0;EZ Game Audio\x1b\x5c');
    expect(writeSpy).toHaveBeenCalledWith('\x1b]2;EZ Game Audio\x1b\x5c');

    writeSpy.mockRestore();
  });
});
