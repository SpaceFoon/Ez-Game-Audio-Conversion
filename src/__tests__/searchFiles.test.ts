import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ESM mocks must be declared BEFORE dynamic imports
jest.unstable_mockModule('fs', () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => ({
  default: {
    whiteBright: {
      bold: jest.fn((text) => text),
    },
    white: jest.fn((text) => text),
    gray: jest.fn((text) => text),
  },
  whiteBright: {
    bold: jest.fn((text) => text),
  },
  white: jest.fn((text) => text),
  gray: jest.fn((text) => text),
}));

// Dynamic imports after mock declarations
const { readdirSync: _readdirSync, statSync: _statSync } = await import('fs');
const { join } = await import('path');
const { default: searchFiles } = await import('../searchFiles.js');

describe('searchFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console.log to avoid polluting test output
    console.log = jest.fn();
  });

  it('should find files with matching extensions', async () => {
    // Mock file structure
    _readdirSync.mockReturnValueOnce(['file1.mp3', 'file2.txt', 'subdir']);
    _readdirSync.mockReturnValueOnce(['file3.wav', 'file4.jpg']);

    // Mock file stats
    _statSync
      .mockImplementationOnce((_path) => ({
        isDirectory: () => false, // file1.mp3
      }))
      .mockImplementationOnce((_path) => ({
        isDirectory: () => false, // file2.txt
      }))
      .mockImplementationOnce((_path) => ({
        isDirectory: () => true, // subdir
      }))
      .mockImplementationOnce((_path) => ({
        isDirectory: () => false, // file3.wav
      }))
      .mockImplementationOnce((_path) => ({
        isDirectory: () => false, // file4.jpg
      }));

    const settings = {
      inputFilePath: '/test/dir',
      inputFormats: ['mp3', 'wav'],
    };

    const result = await searchFiles(settings);
    const expectedFile1 = join('/test/dir', 'file1.mp3');
    const expectedFile2 = join('/test/dir', 'subdir', 'file3.wav');

    // Should find file1.mp3 and file3.wav
    expect(result).toHaveLength(2);
    expect(result.some((file) => file.endsWith(expectedFile1))).toBe(true);
    expect(result.some((file) => file.endsWith(expectedFile2))).toBe(true);
    expect(result.every((file) => !file.endsWith('file2.txt'))).toBe(true);
    expect(
      result.every((file) => !file.endsWith(join('subdir', 'file4.jpg')))
    ).toBe(true);
  });

  it('should handle midi files with both .mid and .midi extensions', async () => {
    // Mock file structure with midi files
    _readdirSync.mockReturnValueOnce(['song1.mid', 'song2.midi', 'song3.mp3']);

    // Mock stats to make all files non-directories
    _statSync.mockImplementation((_path) => ({
      isDirectory: () => false,
    }));

    const settings = {
      inputFilePath: '/test/dir',
      inputFormats: ['midi', 'mp3'],
    };

    const result = await searchFiles(settings);

    // Should find all three files
    expect(result).toHaveLength(3);
    expect(result.some((file) => file.endsWith('song1.mid'))).toBe(true);
    expect(result.some((file) => file.endsWith('song2.midi'))).toBe(true);
    expect(result.some((file) => file.endsWith('song3.mp3'))).toBe(true);
  });

  it('should return an empty array when no matching files are found', async () => {
    // Mock empty directory
    _readdirSync.mockReturnValueOnce(['file1.txt', 'file2.jpg']);

    // Mock stats
    _statSync.mockImplementation((_path) => ({
      isDirectory: () => false,
    }));

    const settings = {
      inputFilePath: '/test/dir',
      inputFormats: ['mp3', 'wav'],
    };

    const result = await searchFiles(settings);

    // Should not find any files
    expect(result).toHaveLength(0);
  });

  it('returns an empty array for an empty directory', async () => {
    _readdirSync.mockReturnValueOnce([]);

    const settings = {
      inputFilePath: '/test/empty',
      inputFormats: ['mp3', 'wav'],
    };

    const result = await searchFiles(settings);

    expect(result).toEqual([]);
    expect(_readdirSync).toHaveBeenCalledWith('/test/empty');
  });

  it('recursively finds matching files in deeply nested folders', async () => {
    _readdirSync
      .mockReturnValueOnce(['level1', 'root.wav'])
      .mockReturnValueOnce(['level2', 'ignore.txt'])
      .mockReturnValueOnce(['level3', 'deep.mp3'])
      .mockReturnValueOnce(['final.flac']);

    _statSync.mockImplementation((targetPath) => ({
      isDirectory: () =>
        String(targetPath).endsWith('level1') ||
        String(targetPath).endsWith('level2') ||
        String(targetPath).endsWith('level3'),
    }));

    const result = await searchFiles({
      inputFilePath: '/test/root',
      inputFormats: ['wav', 'mp3', 'flac'],
    });

    expect(result).toEqual([
      join('/test/root', 'level1', 'level2', 'level3', 'final.flac'),
      join('/test/root', 'level1', 'level2', 'deep.mp3'),
      join('/test/root', 'root.wav'),
    ]);
  });

  it('matches mixed-case file extensions', async () => {
    _readdirSync.mockReturnValueOnce(['Song.WAV', 'theme.Mp3', 'notes.txt']);
    _statSync.mockImplementation(() => ({ isDirectory: () => false }));

    const result = await searchFiles({
      inputFilePath: '/test/case',
      inputFormats: ['wav', 'mp3'],
    });

    expect(result).toEqual([
      join('/test/case', 'Song.WAV'),
      join('/test/case', 'theme.Mp3'),
    ]);
  });

  it('matches files based on the final extension when names contain multiple dots', async () => {
    _readdirSync.mockReturnValueOnce([
      'track.backup.wav',
      'voice.temp.mp3',
      'archive.wav.zip',
    ]);
    _statSync.mockImplementation(() => ({ isDirectory: () => false }));

    const result = await searchFiles({
      inputFilePath: '/test/double-ext',
      inputFormats: ['wav', 'mp3'],
    });

    expect(result).toEqual([
      join('/test/double-ext', 'track.backup.wav'),
      join('/test/double-ext', 'voice.temp.mp3'),
    ]);
  });

  it('skips files without an extension', async () => {
    _readdirSync.mockReturnValueOnce(['README', 'LICENSE', 'theme.ogg']);
    _statSync.mockImplementation(() => ({ isDirectory: () => false }));

    const result = await searchFiles({
      inputFilePath: '/test/no-ext',
      inputFormats: ['ogg'],
    });

    expect(result).toEqual([join('/test/no-ext', 'theme.ogg')]);
  });

  it('handles large flat directories without truncating the result set', async () => {
    const files = Array.from(
      { length: 250 },
      (_, index) => `track-${index}.mp3`
    );
    _readdirSync.mockReturnValueOnce(files);
    _statSync.mockImplementation(() => ({ isDirectory: () => false }));

    const result = await searchFiles({
      inputFilePath: '/test/large',
      inputFormats: ['mp3'],
    });

    expect(result).toHaveLength(250);
    expect(result[0]).toBe(join('/test/large', 'track-0.mp3'));
    expect(result[249]).toBe(join('/test/large', 'track-249.mp3'));
  });

  it('returns the configured single file immediately in single-file mode', async () => {
    const result = await searchFiles({
      inputFilePath: '/ignored',
      inputFormats: ['wav'],
      singleFileMode: true,
      singleFilePath: '/music/special track.wav',
    });

    expect(result).toEqual(['/music/special track.wav']);
    expect(_readdirSync).not.toHaveBeenCalled();
  });
});
