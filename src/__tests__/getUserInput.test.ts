import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import type { Mock } from 'jest-mock';
import { resolve } from 'path';
import type { Settings } from '../types/settings.js';

// ESM mocks must be declared BEFORE dynamic imports
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => {
  const red = Object.assign(
    jest.fn((a) => a),
    {
      bold: jest.fn((a) => a),
    }
  );
  return {
    default: {
      blue: { bold: jest.fn((...a) => a.join(' ')) },
      green: { italic: jest.fn((a) => a) },
      red,
    },
    blue: { bold: jest.fn((...a) => a.join(' ')) },
    green: { italic: jest.fn((a) => a) },
    red,
  };
});

jest.unstable_mockModule('../utils.js', () => ({
  getAnswer: jest.fn(),
}));

// Dynamic imports after mock declarations
const fs = await import('fs');
const { getAnswer } = await import('../utils.js');
const { default: ExitProgramError } = await import('../exitProgramError.js');
const { default: getUserInput } = await import('../getUserInput.js');
const existsSyncMock = fs.existsSync as unknown as Mock<
  (path: string) => boolean
>;
const statSyncMock = fs.statSync as unknown as Mock<
  (path: string) => { isFile: () => boolean; isDirectory: () => boolean }
>;
const mkdirSyncMock = fs.mkdirSync as unknown as Mock<
  (path: string, options?: { recursive?: boolean }) => void
>;
const getAnswerMock = getAnswer as unknown as Mock<
  (question: string | string[]) => Promise<string>
>;

const allFormats = ['flac', 'aiff', 'wav', 'mp3', 'm4a', 'ogg'];
const directoryStats = {
  isFile: () => false,
  isDirectory: () => true,
};
const fileStats = {
  isFile: () => true,
  isDirectory: () => false,
};

describe('getUserInput', () => {
  let settings: Settings;

  beforeEach(() => {
    settings = {} as Settings;
    jest.clearAllMocks();
    // Clear CLI args to force interactive mode in tests
    process.argv = [process.argv[0], process.argv[1]];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('handles valid input and output paths and formats', async () => {
    // Mock path existence
    existsSyncMock.mockReturnValue(true);
    // Mock statSync to be used when code checks CLI arg path; not used in this test but safe
    statSyncMock.mockReturnValue({
      isFile: () => false,
      isDirectory: () => true,
    });

    // Prompt sequence: input folder, output folder, input formats, output formats
    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/path')
      .mockResolvedValueOnce('mp3 wav')
      .mockResolvedValueOnce('ogg');

    const result = await getUserInput(settings);

    expect(result.inputFilePath).toBe(resolve('/input/path'));
    expect(result.outputFilePath).toBe(resolve('/output/path'));
    expect(result.inputFormats).toEqual(['mp3', 'wav']);
    expect(result.outputFormats).toEqual(['ogg']);
  });

  it('returns all allowed formats when both format prompts are blank', async () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/path')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('');

    const result = await getUserInput(settings);

    expect(result.inputFormats).toEqual(allFormats);
    expect(result.outputFormats).toEqual(allFormats);
  });

  it('normalizes mixed-case format input', async () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/path')
      .mockResolvedValueOnce('Mp3 WAV oGg')
      .mockResolvedValueOnce('FlAc M4A');

    const result = await getUserInput(settings);

    expect(result.inputFormats).toEqual(['mp3', 'wav', 'ogg']);
    expect(result.outputFormats).toEqual(['flac', 'm4a']);
  });

  it('deduplicates repeated format input', async () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/path')
      .mockResolvedValueOnce('mp3 MP3 wav mp3 WAV')
      .mockResolvedValueOnce('ogg OGG ogg');

    const result = await getUserInput(settings);

    expect(result.inputFormats).toEqual(['mp3', 'wav']);
    expect(result.outputFormats).toEqual(['ogg']);
  });

  it('rejects invalid CLI file extensions with ExitProgramError', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const cliPath = resolve('C:/input/path/file.txt');

    process.argv = [process.argv[0], process.argv[1], cliPath];
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(fileStats);

    await expect(getUserInput(settings)).rejects.toBeInstanceOf(
      ExitProgramError
    );

    expect(errorSpy).toHaveBeenCalled();
  });

  it('uses single-file mode and infers input format from a valid CLI file path', async () => {
    const cliPath = resolve('C:/input/path/song.MP3');
    const inputFolder = resolve('C:/input/path');

    process.argv = [process.argv[0], process.argv[1], cliPath];
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockImplementation((targetPath: string) =>
      targetPath === cliPath ? fileStats : directoryStats
    );

    getAnswerMock.mockResolvedValueOnce('').mockResolvedValueOnce('ogg');

    const result = await getUserInput(settings);

    expect(result.inputFilePath).toBe(inputFolder);
    expect(result.outputFilePath).toBe(inputFolder);
    expect(result.singleFileMode).toBe(true);
    expect(result.singleFilePath).toBe(cliPath);
    expect(result.inputFormats).toEqual(['mp3']);
    expect(result.outputFormats).toEqual(['ogg']);
    expect(getAnswerMock).toHaveBeenCalledTimes(2);
  });

  it('warns for a missing CLI path and falls back to the interactive flow', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const missingPath = resolve('C:/missing/path');
    const inputPath = resolve('/input/path');

    process.argv = [process.argv[0], process.argv[1], missingPath];
    existsSyncMock.mockImplementation(
      (targetPath: string) => targetPath !== missingPath
    );
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('wav')
      .mockResolvedValueOnce('mp3');

    const result = await getUserInput(settings);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Command-line path does not exist')
    );
    expect(result.inputFilePath).toBe(inputPath);
    expect(result.outputFilePath).toBe(inputPath);
    expect(result.singleFileMode).toBe(false);
    expect(result.inputFormats).toEqual(['wav']);
    expect(result.outputFormats).toEqual(['mp3']);
  });

  it('uses the input path when the output path prompt is blank', async () => {
    const inputPath = resolve('/input/path');

    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('mp3')
      .mockResolvedValueOnce('ogg');

    const result = await getUserInput(settings);

    expect(result.inputFilePath).toBe(inputPath);
    expect(result.outputFilePath).toBe(inputPath);
  });

  it('re-prompts when the interactive input path does not exist', async () => {
    existsSyncMock.mockImplementation(
      (targetPath: string) => targetPath === resolve('/valid/input')
    );
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/missing/input')
      .mockResolvedValueOnce('/valid/input')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('wav')
      .mockResolvedValueOnce('mp3');

    const result = await getUserInput(settings);

    expect(result.inputFilePath).toBe(resolve('/valid/input'));
    expect(getAnswerMock).toHaveBeenCalledTimes(5);
  });

  it('re-prompts when the interactive input path is a file instead of a directory', async () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValueOnce(fileStats).mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/song.mp3')
      .mockResolvedValueOnce('/input')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('wav')
      .mockResolvedValueOnce('ogg');

    const result = await getUserInput(settings);

    expect(result.inputFilePath).toBe(resolve('/input'));
    expect(getAnswerMock).toHaveBeenCalledTimes(5);
  });

  it('creates a missing output directory successfully', async () => {
    existsSyncMock.mockImplementation(
      (targetPath: string) => targetPath === resolve('/input/path')
    );
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/new-folder')
      .mockResolvedValueOnce('wav')
      .mockResolvedValueOnce('mp3');

    const result = await getUserInput(settings);

    expect(mkdirSyncMock).toHaveBeenCalledWith(resolve('/output/new-folder'), {
      recursive: true,
    });
    expect(result.outputFilePath).toBe(resolve('/output/new-folder'));
  });

  it('re-prompts when creating the output directory fails', async () => {
    existsSyncMock.mockImplementation(
      (targetPath: string) =>
        targetPath === resolve('/input/path') ||
        targetPath === resolve('/output/fallback')
    );
    statSyncMock.mockReturnValue(directoryStats);
    mkdirSyncMock.mockImplementationOnce(() => {
      throw new Error('mkdir failed');
    });

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/bad-folder')
      .mockResolvedValueOnce('/output/fallback')
      .mockResolvedValueOnce('wav')
      .mockResolvedValueOnce('mp3');

    const result = await getUserInput(settings);

    expect(mkdirSyncMock).toHaveBeenCalledTimes(1);
    expect(result.outputFilePath).toBe(resolve('/output/fallback'));
  });

  it('re-prompts when the output path is a file instead of a directory', async () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock
      .mockReturnValueOnce(directoryStats)
      .mockReturnValueOnce(fileStats)
      .mockReturnValueOnce(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/file.mp3')
      .mockResolvedValueOnce('/output/folder')
      .mockResolvedValueOnce('wav')
      .mockResolvedValueOnce('ogg');

    const result = await getUserInput(settings);

    expect(result.outputFilePath).toBe(resolve('/output/folder'));
    expect(getAnswerMock).toHaveBeenCalledTimes(5);
  });

  it('re-prompts until a valid input format is provided', async () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/path')
      .mockResolvedValueOnce('wavv midi')
      .mockResolvedValueOnce('wav mp3')
      .mockResolvedValueOnce('ogg');

    const result = await getUserInput(settings);

    expect(result.inputFormats).toEqual(['wav', 'mp3']);
    expect(getAnswerMock).toHaveBeenCalledTimes(5);
  });

  it('re-prompts until a valid output format is provided', async () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/path')
      .mockResolvedValueOnce('wav')
      .mockResolvedValueOnce('aac')
      .mockResolvedValueOnce('mp3 flac');

    const result = await getUserInput(settings);

    expect(result.outputFormats).toEqual(['mp3', 'flac']);
    expect(getAnswerMock).toHaveBeenCalledTimes(5);
  });

  it('handles paths with spaces during the interactive flow', async () => {
    const inputPath = resolve('C:/My Game Audio/Input Files');
    const outputPath = resolve('C:/My Game Audio/Converted Output');

    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('C:/My Game Audio/Input Files')
      .mockResolvedValueOnce('C:/My Game Audio/Converted Output')
      .mockResolvedValueOnce('wav')
      .mockResolvedValueOnce('ogg');

    const result = await getUserInput(settings);

    expect(result.inputFilePath).toBe(inputPath);
    expect(result.outputFilePath).toBe(outputPath);
  });

  it('uses batch mode when the CLI argument is a directory', async () => {
    const cliPath = resolve('C:/input/library');

    process.argv = [process.argv[0], process.argv[1], cliPath];
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue(directoryStats);

    getAnswerMock
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('wav mp3')
      .mockResolvedValueOnce('ogg');

    const result = await getUserInput(settings);

    expect(result.inputFilePath).toBe(cliPath);
    expect(result.outputFilePath).toBe(cliPath);
    expect(result.singleFileMode).toBe(false);
    expect(result.inputFormats).toEqual(['wav', 'mp3']);
  });

  it('throws ExitProgramError when the CLI path is neither a file nor a directory', async () => {
    const cliPath = resolve('C:/mystery/device');

    process.argv = [process.argv[0], process.argv[1], cliPath];
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue({
      isFile: () => false,
      isDirectory: () => false,
    });

    await expect(getUserInput(settings)).rejects.toBeInstanceOf(
      ExitProgramError
    );
  });
});
