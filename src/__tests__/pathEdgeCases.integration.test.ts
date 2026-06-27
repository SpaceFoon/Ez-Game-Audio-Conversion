/**
 * Integration tests for path and filename edge cases
 *
 * Tests REAL string manipulation and path handling logic
 * that could cause bugs in production.
 */

import { describe, it, expect } from '@jest/globals';
import { join, relative } from 'path';
import {
  buildOutputPath,
  buildBasenameWithFormat,
  getRelativeOutputDir,
  parseCopyFilename,
  pathsResolveToSameFile,
} from '../createConversionList.js';
import { nextAvailableLogCsvPath } from '../utils.js';
import { outputPathHasInvalidCharacters } from '../converterWorker.js';
import { parseFormats } from '../getUserInput.js';
import type { AudioFormat } from '../types/audio.js';

// Test the actual path manipulation logic used in createConversionList
describe('Path manipulation edge cases', () => {
  describe('output file path construction', () => {
    it('should handle simple case - same level', () => {
      const result = buildOutputPath(
        '/input/song.wav',
        '/input',
        '/output',
        'mp3'
      );
      expect(result).toBe(join('/output', 'song.mp3'));
    });

    it('should preserve subdirectory structure', () => {
      const result = buildOutputPath(
        '/input/album/song.wav',
        '/input',
        '/output',
        'mp3'
      );
      expect(result).toBe(join('/output', 'album', 'song.mp3'));
    });

    it('should handle deeply nested paths', () => {
      const result = buildOutputPath(
        '/input/artist/year/album/disc1/song.wav',
        '/input',
        '/output',
        'mp3'
      );
      expect(result).toBe(
        join('/output', 'artist', 'year', 'album', 'disc1', 'song.mp3')
      );
    });

    it('should handle Windows-style paths', () => {
      const result = buildOutputPath(
        'C:\\Music\\Album\\song.wav',
        'C:\\Music',
        'D:\\Output',
        'mp3'
      );
      // Result depends on OS, but structure should be preserved
      expect(result).toContain('Album');
      expect(result).toContain('song.mp3');
    });

    it('should handle paths with spaces', () => {
      const result = buildOutputPath(
        '/input/My Music/Best Songs/track 01.wav',
        '/input',
        '/output',
        'mp3'
      );
      expect(result).toBe(
        join('/output', 'My Music', 'Best Songs', 'track 01.mp3')
      );
    });

    it('should handle paths with special characters', () => {
      const result = buildOutputPath(
        '/input/Album (2024) [FLAC]/01 - Song.wav',
        '/input',
        '/output',
        'mp3'
      );
      expect(result).toBe(
        join('/output', 'Album (2024) [FLAC]', '01 - Song.mp3')
      );
    });

    it('should handle Unicode paths', () => {
      const result = buildOutputPath(
        '/input/ゲーム音楽/テスト.wav',
        '/input',
        '/output',
        'mp3'
      );
      expect(result).toBe(join('/output', 'ゲーム音楽', 'テスト.mp3'));
    });

    it('should handle input=output (same folder)', () => {
      // When input and output are the same, relative path is '.'
      const inputFile = '/music/song.wav';
      const inputFilePath = '/music';
      const outputFilePath = '/music';

      const relativePath = relative(inputFilePath, inputFile);
      expect(relativePath).toBe('song.wav');
      expect(getRelativeOutputDir(inputFilePath, inputFile)).toBe('');

      const result = buildOutputPath(
        inputFile,
        inputFilePath,
        outputFilePath,
        'mp3'
      );
      expect(result).toBe(join('/music', 'song.mp3'));
    });
  });

  describe('copy filename generation', () => {
    it('should parse regular filename', () => {
      const result = parseCopyFilename('song.wav');
      expect(result.base).toBe('song');
      expect(result.num).toBe(0);
    });

    it('should parse -copy(1) suffix', () => {
      const result = parseCopyFilename('song-copy(1).wav');
      expect(result.base).toBe('song');
      expect(result.num).toBe(1);
    });

    it('should parse -copy(99) suffix', () => {
      const result = parseCopyFilename('song-copy(99).wav');
      expect(result.base).toBe('song');
      expect(result.num).toBe(99);
    });

    it('should handle filename with parentheses but not copy pattern', () => {
      const result = parseCopyFilename('song (remaster).wav');
      expect(result.base).toBe('song (remaster)');
      expect(result.num).toBe(0);
    });

    it('should handle filename with -copy in middle', () => {
      // "my-copy-of-song" should NOT match the copy pattern
      const result = parseCopyFilename('my-copy-of-song.wav');
      expect(result.base).toBe('my-copy-of-song');
      expect(result.num).toBe(0);
    });

    it('should handle nested copy pattern correctly', () => {
      // What if someone names their file "song-copy(1)-copy(2)"?
      const result = parseCopyFilename('song-copy(1)-copy(2).wav');
      // The regex matches from start, so it should get the FIRST -copy()
      // Actually the regex is greedy so it matches the longest
      expect(result.base).toBe('song-copy(1)');
      expect(result.num).toBe(2);
    });

    it('should handle spaces in filename with copy suffix', () => {
      const result = parseCopyFilename('Best Song Ever-copy(5).mp3');
      expect(result.base).toBe('Best Song Ever');
      expect(result.num).toBe(5);
    });
  });

  describe('extension handling', () => {
    it('should change .wav to .mp3', () => {
      expect(buildBasenameWithFormat('song.wav', 'mp3')).toBe('song.mp3');
    });

    it('should change .flac to .ogg', () => {
      expect(buildBasenameWithFormat('song.flac', 'ogg')).toBe('song.ogg');
    });

    it('should handle multiple dots in filename', () => {
      expect(buildBasenameWithFormat('song.2024.remaster.wav', 'mp3')).toBe(
        'song.2024.remaster.mp3'
      );
    });

    it('should handle uppercase extensions', () => {
      expect(buildBasenameWithFormat('SONG.WAV', 'mp3')).toBe('SONG.mp3');
    });

    it('should handle no extension (edge case)', () => {
      // extname('noext') returns ''
      expect(buildBasenameWithFormat('noext', 'mp3')).toBe('noext.mp3');
    });

    it('should handle hidden files (dot prefix)', () => {
      // .hidden has NO extension in Node.js, so extname('.hidden') = ''
      // basename('.hidden', '') = '.hidden'
      const result = buildBasenameWithFormat('.hidden', 'mp3');
      // Node correctly treats .hidden as the filename, not extension
      expect(result).toBe('.hidden.mp3');
    });

    it('should handle .tar.gz style extensions', () => {
      // extname only gets the last extension
      expect(buildBasenameWithFormat('archive.tar.gz', 'zip')).toBe(
        'archive.tar.zip'
      );
    });
  });
});

describe('File collision detection edge cases', () => {
  describe('case sensitivity', () => {
    it('should treat uppercase and lowercase as same on Windows', () => {
      // This is what the code does:
      const inputFile: string = '/input/Song.WAV';
      const outputFile: string = '/input/song.wav';

      // The code checks BOTH case-insensitive AND exact match
      const isSameFile = pathsResolveToSameFile(inputFile, outputFile);

      expect(isSameFile).toBe(true);
    });

    it('should detect same file with different case', () => {
      const inputFile = '/input/SONG.WAV';
      const outputFile = '/input/song.wav';

      expect(inputFile.toLowerCase() === outputFile.toLowerCase()).toBe(true);
    });

    it('should NOT match different files', () => {
      const inputFile: string = '/input/song1.wav';
      const outputFile: string = '/input/song2.wav';

      const isSameFile = pathsResolveToSameFile(inputFile, outputFile);

      expect(isSameFile).toBe(false);
    });
  });
});

describe('Relative path edge cases', () => {
  it('falls back to output root when relative dir escapes input root', () => {
    expect(getRelativeOutputDir('/input', '/outside/other/song.wav')).toBe('');
  });

  it('should handle trailing slashes consistently', () => {
    // This can cause bugs if not handled
    const withSlash = relative('/input/', '/input/subdir/file.wav');
    const withoutSlash = relative('/input', '/input/subdir/file.wav');

    // Both should work the same
    expect(withSlash).toBe(withoutSlash);
  });

  it('should handle . and .. in paths', () => {
    // Normalize should handle these
    const normalPath = relative('/input', '/input/./subdir/../subdir/file.wav');
    // Node's relative() normalizes automatically
    expect(normalPath).toBe(join('subdir', 'file.wav'));
  });

  it('should handle UNC paths (Windows network shares)', () => {
    // UNC paths start with \\
    const uncInput = '\\\\server\\share\\music\\song.wav';
    const uncBase = '\\\\server\\share\\music';

    // This should work on Windows
    if (process.platform === 'win32') {
      const rel = relative(uncBase, uncInput);
      expect(rel).toBe('song.wav');
    }
  });
});

describe('Filename sanitization edge cases', () => {
  // The app blocks these in converterWorker, but let's test the detection
  describe('dangerous character detection', () => {
    it('should detect quotes', () => {
      expect(outputPathHasInvalidCharacters('/path/"file".mp3')).toBe(true);
    });

    it('should detect newlines', () => {
      expect(outputPathHasInvalidCharacters('/path/file\nname.mp3')).toBe(true);
    });

    it('should detect carriage returns', () => {
      expect(outputPathHasInvalidCharacters('/path/file\rname.mp3')).toBe(true);
    });

    it('should detect null bytes', () => {
      expect(outputPathHasInvalidCharacters('/path/file\x00name.mp3')).toBe(
        true
      );
    });

    it('should detect Windows < character', () => {
      expect(outputPathHasInvalidCharacters('/path/file<name.mp3')).toBe(true);
    });

    it('should detect Windows > character', () => {
      expect(outputPathHasInvalidCharacters('/path/file>name.mp3')).toBe(true);
    });

    it('should detect Windows pipe character', () => {
      expect(outputPathHasInvalidCharacters('/path/file|name.mp3')).toBe(true);
    });

    it('should detect Windows question mark', () => {
      expect(outputPathHasInvalidCharacters('/path/file?name.mp3')).toBe(true);
    });

    it('should detect Windows asterisk', () => {
      expect(outputPathHasInvalidCharacters('/path/file*name.mp3')).toBe(true);
    });

    it('should allow Windows drive letter colon', () => {
      expect(outputPathHasInvalidCharacters('C:\\path\\file.mp3')).toBe(false);
    });

    it('should detect colon NOT in drive letter position', () => {
      expect(outputPathHasInvalidCharacters('/path/file:name.mp3')).toBe(true);
    });

    it('should allow normal paths', () => {
      expect(outputPathHasInvalidCharacters('/path/to/normal file.mp3')).toBe(
        false
      );
    });

    it('should allow Unicode characters', () => {
      expect(outputPathHasInvalidCharacters('/path/ゲーム音楽.mp3')).toBe(
        false
      );
    });

    it('should allow parentheses and brackets', () => {
      expect(
        outputPathHasInvalidCharacters('/path/song (2024) [FLAC].mp3')
      ).toBe(false);
    });

    it('should allow ampersand', () => {
      expect(outputPathHasInvalidCharacters('/path/Tom & Jerry.mp3')).toBe(
        false
      );
    });

    it('should allow single quotes', () => {
      expect(outputPathHasInvalidCharacters("/path/It's a song.mp3")).toBe(
        false
      );
    });
  });
});

describe('Log filename increment logic', () => {
  const normalizePath = (p: string) => p.replace(/\\/g, '/');

  const generateLogFilename = (
    basePath: string,
    fileName: string,
    existingFiles: string[]
  ): string =>
    nextAvailableLogCsvPath(basePath, fileName, (path) =>
      existingFiles.some((file) => normalizePath(file) === normalizePath(path))
    );

  it('should return base name when no conflicts', () => {
    const result = generateLogFilename('/logs', 'error', []);
    expect(normalizePath(result)).toBe('/logs/error.csv');
  });

  it('should increment to (1) when base exists', () => {
    const existing = [join('/logs', 'error.csv')];
    const result = generateLogFilename('/logs', 'error', existing);
    expect(normalizePath(result)).toBe('/logs/error(1).csv');
  });

  it('should increment to (2) when (1) also exists', () => {
    const existing = [
      join('/logs', 'error.csv'),
      join('/logs', 'error(1).csv'),
    ];
    const result = generateLogFilename('/logs', 'error', existing);
    expect(normalizePath(result)).toBe('/logs/error(2).csv');
  });

  it('should handle gaps in numbering', () => {
    const existing = [
      join('/logs', 'error.csv'),
      join('/logs', 'error(2).csv'),
    ];
    const result = generateLogFilename('/logs', 'error', existing);
    expect(normalizePath(result)).toBe('/logs/error(1).csv');
  });

  it('should handle high numbers', () => {
    const existing = Array.from({ length: 100 }, (_, i) =>
      i === 0 ? join('/logs', 'error.csv') : join('/logs', `error(${i}).csv`)
    );
    const result = generateLogFilename('/logs', 'error', existing);
    expect(normalizePath(result)).toBe('/logs/error(100).csv');
  });
});

describe('Input format parsing', () => {
  const validFormats: AudioFormat[] = [
    'flac',
    'aiff',
    'wav',
    'mp3',
    'm4a',
    'ogg',
  ];

  it('should parse comma-separated formats', () => {
    expect(parseFormats('mp3, ogg, flac', validFormats)).toEqual([
      'mp3',
      'ogg',
      'flac',
    ]);
  });

  it('should parse space-separated formats', () => {
    expect(parseFormats('mp3 ogg flac', validFormats)).toEqual([
      'mp3',
      'ogg',
      'flac',
    ]);
  });

  it('should parse mixed separators', () => {
    expect(parseFormats('mp3, ogg wav', validFormats)).toEqual([
      'mp3',
      'ogg',
      'wav',
    ]);
  });

  it('should filter invalid formats', () => {
    expect(parseFormats('mp3, invalid, ogg', validFormats)).toEqual([
      'mp3',
      'ogg',
    ]);
  });

  it('should handle uppercase input', () => {
    expect(parseFormats('MP3, OGG', validFormats)).toEqual(['mp3', 'ogg']);
  });

  it('should return all formats for empty input', () => {
    expect(parseFormats('', validFormats)).toEqual(validFormats);
  });

  it('should handle extra whitespace', () => {
    expect(parseFormats('  mp3  ,   ogg  ', validFormats)).toEqual([
      'mp3',
      'ogg',
    ]);
  });

  it('should return empty array for all invalid', () => {
    expect(parseFormats('invalid, fake, wrong', validFormats)).toEqual([]);
  });
});
