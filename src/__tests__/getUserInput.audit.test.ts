import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { resolve } from 'path';

jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => {
  const red = Object.assign(
    jest.fn((text: string) => text),
    {
      bold: jest.fn((text: string) => text),
    }
  );

  return {
    default: {
      blue: { bold: jest.fn((...parts: string[]) => parts.join(' ')) },
      green: { italic: jest.fn((text: string) => text) },
      red,
    },
    blue: { bold: jest.fn((...parts: string[]) => parts.join(' ')) },
    green: { italic: jest.fn((text: string) => text) },
    red,
  };
});

jest.unstable_mockModule('../utils.js', () => ({
  getAnswer: jest.fn(),
}));

const fs = await import('fs');
const { getAnswer } = await import('../utils.js');
const { default: getUserInput } = await import('../getUserInput.js');

const existsSyncMock = fs.existsSync as unknown as jest.MockedFunction<
  typeof fs.existsSync
>;
const statSyncMock = fs.statSync as unknown as jest.MockedFunction<
  typeof fs.statSync
>;
const getAnswerMock = getAnswer as unknown as jest.MockedFunction<
  typeof getAnswer
>;

const directoryStats = {
  isFile: () => false,
  isDirectory: () => true,
};

describe('getUserInput audit characterizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.argv = [process.argv[0], process.argv[1]];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('silently drops invalid format tokens when at least one valid token remains', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(directoryStats as never);
    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/path')
      .mockResolvedValueOnce('mp3 mp44')
      .mockResolvedValueOnce('ogg flaccc');

    const result = await getUserInput({} as never);

    expect(result.inputFormats).toEqual(['mp3']);
    expect(result.outputFormats).toEqual(['ogg']);
    expect(getAnswerMock).toHaveBeenCalledTimes(4);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid input format')
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid output format')
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Unrecognized format')
    );
  });

  it('treats a blank interactive input path as the current working directory', async () => {
    const cwdPath = resolve('');

    existsSyncMock.mockImplementation(
      (targetPath: Parameters<typeof fs.existsSync>[0]) =>
        String(targetPath) === cwdPath
    );
    statSyncMock.mockReturnValue(directoryStats as never);
    getAnswerMock
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('wav')
      .mockResolvedValueOnce('mp3');

    const result = await getUserInput({} as never);

    expect(result.inputFilePath).toBe(cwdPath);
    expect(result.outputFilePath).toBe(cwdPath);
  });

  it('rejects when statSync fails after the path existence check passes', async () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });
    getAnswerMock.mockResolvedValueOnce('/protected/path');

    await expect(getUserInput({} as never)).rejects.toThrow(
      'EACCES: permission denied'
    );
  });
});
