import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';

// ESM mocks must be declared BEFORE dynamic imports
jest.unstable_mockModule('../utils.js', () => ({
  settings: { outputFilePath: '/output' },
  rl: { question: jest.fn(), close: jest.fn() },
  isPackagedRuntime: false,
  runtimeBaseDir: '/mock/base',
  writeSummaryToLogs: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => ({
  default: { blue: jest.fn((a: string) => a) },
  blue: jest.fn((a: string) => a),
}));

// Dynamic imports after mock declarations
const { rl, writeSummaryToLogs } = await import('../utils.js');
const { default: finalize } = await import('../finalize.js');

import type { ConversionResult } from '../types/audio.js';

describe('finalize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (rl.question as Mock<(...args: unknown[]) => unknown>).mockImplementation(
      (_msg: unknown, cb: unknown) => (cb as (answer: string) => void)('')
    );
  });

  it('logs successful and failed files and restarts', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const failedFiles: ConversionResult[] = [
      { success: false, inputFile: 'in.wav', outputFile: 'fail.mp3' },
    ];
    const successfulFiles: ConversionResult[] = [
      { success: true, inputFile: 'in.wav', outputFile: 'ok.mp3' },
    ];
    await finalize(failedFiles, successfulFiles, 0);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('logs when there are no successful files', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const failedFiles: ConversionResult[] = [
      { success: false, inputFile: 'in.wav', outputFile: 'fail.mp3' },
    ];
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
    const successfulFiles: ConversionResult[] = [
      { success: true, inputFile: 'in.wav', outputFile: 'ok.mp3' },
    ];
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

  it('calls rl.question and returns true by default', async () => {
    (rl.question as Mock<(...args: unknown[]) => unknown>).mockImplementation(
      (_msg: unknown, cb: unknown) => (cb as () => void)()
    );
    const shouldContinue = await finalize(
      [],
      [{ success: true, inputFile: 'in.wav', outputFile: 'ok.mp3' }],
      0
    );
    expect(rl.question).toHaveBeenCalled();
    expect(shouldContinue).toBe(true);
  });

  it('returns false and closes rl when user chooses quit', async () => {
    (rl.question as Mock<(...args: unknown[]) => unknown>).mockImplementation(
      (_msg: unknown, cb: unknown) => (cb as (answer: string) => void)('q')
    );
    (rl.close as Mock).mockImplementation(() => {});

    const shouldContinue = await finalize(
      [],
      [{ success: true, inputFile: 'in.wav', outputFile: 'ok.mp3' }],
      0
    );
    expect(shouldContinue).toBe(false);
    expect(rl.close).toHaveBeenCalled();
  });

  it.each(['quit', 'exit'])(
    'returns false for %s as an exit command',
    async (answer) => {
      (rl.question as Mock<(...args: unknown[]) => unknown>).mockImplementation(
        (_msg: unknown, cb: unknown) => (cb as (value: string) => void)(answer)
      );
      (rl.close as Mock).mockImplementation(() => {});

      await expect(
        finalize(
          [],
          [{ success: true, inputFile: 'in.wav', outputFile: 'ok.mp3' }],
          0
        )
      ).resolves.toBe(false);

      expect(rl.close).toHaveBeenCalled();
    }
  );

  it('handles undefined arguments gracefully', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await expect(
      finalize(
        undefined as unknown as ConversionResult[],
        undefined as unknown as ConversionResult[],
        0
      )
    ).resolves.toBe(true);
    logSpy.mockRestore();
  });

  it('calls writeSummaryToLogs with correct arguments', async () => {
    const failedFiles: ConversionResult[] = [
      { success: false, inputFile: 'in1.wav', outputFile: 'fail1.mp3' },
      { success: false, inputFile: 'in2.wav', outputFile: 'fail2.mp3' },
    ];
    const successfulFiles: ConversionResult[] = [
      { success: true, inputFile: 'in3.wav', outputFile: 'ok1.mp3' },
      { success: true, inputFile: 'in4.wav', outputFile: 'ok2.mp3' },
      { success: true, inputFile: 'in5.wav', outputFile: 'ok3.mp3' },
    ];

    await finalize(failedFiles, successfulFiles, 0);

    // Total = 5, Success = 3, Failed = 2
    expect(writeSummaryToLogs).toHaveBeenCalledWith(
      5, // total files
      3, // success count
      2, // fail count
      expect.any(Number) // duration in seconds
    );
  });

  it('calls writeSummaryToLogs even with empty arrays', async () => {
    await finalize([], [], 0);

    expect(writeSummaryToLogs).toHaveBeenCalledWith(
      0, // total files
      0, // success count
      0, // fail count
      expect.any(Number) // duration
    );
  });

  it('logs formatted total and average durations', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(5000);

    await finalize(
      [],
      [
        { success: true, inputFile: 'in1.wav', outputFile: 'ok1.mp3' },
        { success: true, inputFile: 'in2.wav', outputFile: 'ok2.mp3' },
      ],
      1000
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Total job duration: 4.00 seconds')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Average task duration 2.00 seconds')
    );

    dateNowSpy.mockRestore();
    logSpy.mockRestore();
  });
});
