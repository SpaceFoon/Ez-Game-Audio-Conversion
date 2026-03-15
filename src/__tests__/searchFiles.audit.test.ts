import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Characterization tests for audit findings.
// These intentionally assert the CURRENT broken behavior so the audit can be
// verified in code, then inverted when the implementation is fixed.

jest.unstable_mockModule('fs', () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => ({
  default: {
    whiteBright: { bold: jest.fn((...args) => args.join(' ')) },
    white: jest.fn((...args) => args.join(' ')),
    gray: jest.fn((...args) => args.join(' ')),
  },
  whiteBright: { bold: jest.fn((...args) => args.join(' ')) },
  white: jest.fn((...args) => args.join(' ')),
  gray: jest.fn((...args) => args.join(' ')),
}));

const fs = await import('fs');
const { default: searchFiles } = await import('../searchFiles.js');

const readdirSyncMock = fs.readdirSync as unknown as jest.MockedFunction<
  typeof fs.readdirSync
>;
const statSyncMock = fs.statSync as unknown as jest.MockedFunction<
  typeof fs.statSync
>;

describe('searchFiles audit characterization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  it('proves one unreadable entry aborts the entire walk instead of being skipped', async () => {
    readdirSyncMock.mockReturnValueOnce(['good.mp3', 'broken.wav']);
    statSyncMock.mockImplementation((targetPath) => {
      if (String(targetPath).endsWith('broken.wav')) {
        throw new Error('EACCES: permission denied');
      }
      return { isDirectory: () => false } as ReturnType<typeof fs.statSync>;
    });

    expect(() =>
      searchFiles({
        inputFilePath: '/audit/input',
        inputFormats: ['mp3', 'wav'],
      } as never)
    ).toThrow('EACCES: permission denied');
  });

  it('proves there is no cycle protection when recursion revisits the same logical directory', async () => {
    let readCount = 0;

    readdirSyncMock.mockImplementation(() => {
      readCount += 1;
      if (readCount > 6) {
        throw new Error('cycle sentinel');
      }
      return ['loop'];
    });

    statSyncMock.mockReturnValue({
      isDirectory: () => true,
    } as ReturnType<typeof fs.statSync>);

    expect(() =>
      searchFiles({
        inputFilePath: '/audit/root',
        inputFormats: ['wav'],
      } as never)
    ).toThrow('cycle sentinel');

    expect(readdirSyncMock).toHaveBeenCalledTimes(7);
    expect(statSyncMock).toHaveBeenCalledTimes(6);
  });
});
