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
jest.unstable_mockModule('perf_hooks', () => ({
  performance: { now: jest.fn() },
}));

jest.unstable_mockModule('../utils.js', () => ({
  settings: { outputFilePath: '/output' },
  rl: { question: jest.fn(), close: jest.fn() },
  isPackagedRuntime: false,
  runtimeBaseDir: '/mock/base',
}));

jest.unstable_mockModule('chalk', () => ({
  default: { blue: jest.fn((a: string) => a) },
  blue: jest.fn((a: string) => a),
}));

jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn(),
}));

// Dynamic imports after mock declarations
const { performance } = await import('perf_hooks');
const { spawn } = await import('child_process');
const { rl } = await import('../utils.js');
const { default: finalize } = await import('../finalize.js');

interface ConversionResult {
  outputFile: string;
}

describe('finalize', () => {
  let exitSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
    (performance.now as Mock).mockReturnValueOnce(0).mockReturnValueOnce(10000);
  });

  afterEach(() => {
    if (exitSpy?.mockRestore) exitSpy.mockRestore();
  });

  it('logs successful and failed files and restarts', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const failedFiles: ConversionResult[] = [{ outputFile: 'fail.mp3' }];
    const successfulFiles: ConversionResult[] = [{ outputFile: 'ok.mp3' }];
    await finalize(failedFiles, successfulFiles, 0);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('logs when there are no successful files', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const failedFiles: ConversionResult[] = [{ outputFile: 'fail.mp3' }];
    const successfulFiles: ConversionResult[] = [];
    await finalize(failedFiles, successfulFiles, 0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('NO SUCCESSFUL CONVERSIONS')
    );
    logSpy.mockRestore();
  });

  it('logs when there are no failed files', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const failedFiles: ConversionResult[] = [];
    const successfulFiles: ConversionResult[] = [{ outputFile: 'ok.mp3' }];
    await finalize(failedFiles, successfulFiles, 0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No conversions failed')
    );
    logSpy.mockRestore();
  });

  it('handles both lists empty', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await finalize([], [], 0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('NO SUCCESSFUL CONVERSIONS')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No conversions failed')
    );
    logSpy.mockRestore();
  });

  it('calls rl.question and rl.close', async () => {
    (rl.question as Mock).mockImplementation((_msg: string, cb: () => void) => cb());
    (rl.close as Mock).mockImplementation(() => {});
    await finalize([], [{ outputFile: 'ok.mp3' }], 0);
    expect(rl.question).toHaveBeenCalled();
    expect(rl.close).toHaveBeenCalled();
  });

  it('calls spawn and process.exit for restart', async () => {
    const localExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
    await finalize([], [{ outputFile: 'ok.mp3' }], 0);
    expect(spawn).toHaveBeenCalled();
    expect(localExitSpy).toHaveBeenCalled();
    localExitSpy.mockRestore();
  });

  it('handles undefined arguments gracefully', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await finalize(undefined as unknown as ConversionResult[], undefined as unknown as ConversionResult[], 0);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
