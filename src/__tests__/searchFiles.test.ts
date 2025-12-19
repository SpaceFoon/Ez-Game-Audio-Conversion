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
  },
  whiteBright: {
    bold: jest.fn((text) => text),
  },
  white: jest.fn((text) => text),
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
});
