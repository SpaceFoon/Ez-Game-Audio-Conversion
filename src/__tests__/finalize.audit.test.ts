import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../utils.js', () => ({
  settings: { outputFilePath: '/output' },
  rl: {
    question: jest.fn((_msg: string, cb: (answer: string) => void) => cb('')),
    close: jest.fn(),
  },
  writeSummaryToLogs: jest.fn(),
  reportSearchErrors: jest.fn(async () => {}),
}));

jest.unstable_mockModule('chalk', () => ({
  default: { blue: jest.fn((text: string) => text) },
  blue: jest.fn((text: string) => text),
}));

const { reportSearchErrors } = await import('../utils.js');
const { default: finalize } = await import('../finalize.js');

const reportSearchErrorsMock = reportSearchErrors as unknown as jest.Mock;

describe('audit characterization: finalize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
  });

  it('calls reportSearchErrors at end of every batch including all-success runs', async () => {
    await finalize(
      [],
      [{ success: true, inputFile: '/in/a.wav', outputFile: '/out/a.mp3' }],
      Date.now() - 1000
    );

    expect(reportSearchErrorsMock).toHaveBeenCalledTimes(1);
  });

  it('calls reportSearchErrors even when every conversion failed', async () => {
    await finalize(
      [{ success: false, inputFile: '/in/a.wav', outputFile: '/out/a.mp3' }],
      [],
      Date.now() - 1000
    );

    expect(reportSearchErrorsMock).toHaveBeenCalledTimes(1);
  });
});
