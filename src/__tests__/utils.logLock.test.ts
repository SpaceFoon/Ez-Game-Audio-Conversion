/**
 * When a log file stays locked after every retry, isFileBusy reports it as
 * busy — the CSV writer must then skip the write instead of writing anyway.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';

jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(),
  openSync: jest.fn(),
  closeSync: jest.fn(),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

const fs = await import('fs');
const { addToLog, __setLogFileStateForTests } = await import('../utils.js');

const existsSyncMock = fs.existsSync as unknown as Mock<(p: string) => boolean>;
const openSyncMock = fs.openSync as unknown as Mock<() => number>;
const appendFileSyncMock = fs.appendFileSync as unknown as Mock<() => void>;

describe('addToLog with a permanently locked log file', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    __setLogFileStateForTests('/test/logs.csv', '/test/error.csv');
    existsSyncMock.mockReturnValue(true);
    const busy = Object.assign(new Error('EBUSY: resource busy'), {
      code: 'EBUSY',
    });
    openSyncMock.mockImplementation(() => {
      throw busy;
    });
  });

  it('does not append once isFileBusy gives up', async () => {
    const result = await addToLog(
      { type: 'code', data: 0 },
      { inputFile: '/in/a.wav', outputFile: '/out/a.mp3' }
    );

    expect(appendFileSyncMock).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});
