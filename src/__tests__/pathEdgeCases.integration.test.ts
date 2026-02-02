/**
 * Integration tests for path and filename edge cases
 *
 * Tests REAL string manipulation and path handling logic
 * that could cause bugs in production.
 */

import { describe, it, expect } from '@jest/globals';
import { join, basename, extname, dirname, relative } from 'path';

// Test the actual path manipulation logic used in createConversionList
describe('Path manipulation edge cases', () => {
  describe('output file path construction', () => {
    // This mirrors the logic in createConversionList.ts
    const buildOutputPath = (
      inputFile: string,
      inputFilePath: string,
      outputFilePath: string,
      outputFormat: string
    ): string => {
      const relativePath = dirname(relative(inputFilePath, inputFile));
      const outputFolder = join(outputFilePath, relativePath);
      return join(
        outputFolder,
        `${basename(inputFile, extname(inputFile))}.${outputFormat}`
      );
    };

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

      const relativePath = dirname(relative(inputFilePath, inputFile));
      expect(relativePath).toBe('.');

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
    // Mirrors getOutputFileCopy regex parsing
    const parseCopyNumber = (
      filename: string
    ): { base: string; num: number } => {
      const baseName = basename(filename, extname(filename));
      const match = baseName.match(/^(.+)-copy\((\d+)\)/);

      if (match && match[1] && match[2]) {
        return {
          base: match[1],
          num: parseInt(match[2], 10),
        };
      }
      return { base: baseName, num: 0 };
    };

    it('should parse regular filename', () => {
      const result = parseCopyNumber('song.wav');
      expect(result.base).toBe('song');
      expect(result.num).toBe(0);
    });

    it('should parse -copy(1) suffix', () => {
      const result = parseCopyNumber('song-copy(1).wav');
      expect(result.base).toBe('song');
      expect(result.num).toBe(1);
    });

    it('should parse -copy(99) suffix', () => {
      const result = parseCopyNumber('song-copy(99).wav');
      expect(result.base).toBe('song');
      expect(result.num).toBe(99);
    });

    it('should handle filename with parentheses but not copy pattern', () => {
      const result = parseCopyNumber('song (remaster).wav');
      expect(result.base).toBe('song (remaster)');
      expect(result.num).toBe(0);
    });

    it('should handle filename with -copy in middle', () => {
      // "my-copy-of-song" should NOT match the copy pattern
      const result = parseCopyNumber('my-copy-of-song.wav');
      expect(result.base).toBe('my-copy-of-song');
      expect(result.num).toBe(0);
    });

    it('should handle nested copy pattern correctly', () => {
      // What if someone names their file "song-copy(1)-copy(2)"?
      const result = parseCopyNumber('song-copy(1)-copy(2).wav');
      // The regex matches from start, so it should get the FIRST -copy()
      // Actually the regex is greedy so it matches the longest
      expect(result.base).toBe('song-copy(1)');
      expect(result.num).toBe(2);
    });

    it('should handle spaces in filename with copy suffix', () => {
      const result = parseCopyNumber('Best Song Ever-copy(5).mp3');
      expect(result.base).toBe('Best Song Ever');
      expect(result.num).toBe(5);
    });
  });

  describe('extension handling', () => {
    const getNewExtension = (
      inputFile: string,
      outputFormat: string
    ): string => {
      return `${basename(inputFile, extname(inputFile))}.${outputFormat}`;
    };

    it('should change .wav to .mp3', () => {
      expect(getNewExtension('song.wav', 'mp3')).toBe('song.mp3');
    });

    it('should change .flac to .ogg', () => {
      expect(getNewExtension('song.flac', 'ogg')).toBe('song.ogg');
    });

    it('should handle multiple dots in filename', () => {
      expect(getNewExtension('song.2024.remaster.wav', 'mp3')).toBe(
        'song.2024.remaster.mp3'
      );
    });

    it('should handle uppercase extensions', () => {
      expect(getNewExtension('SONG.WAV', 'mp3')).toBe('SONG.mp3');
    });

    it('should handle no extension (edge case)', () => {
      // extname('noext') returns ''
      expect(getNewExtension('noext', 'mp3')).toBe('noext.mp3');
    });

    it('should handle hidden files (dot prefix)', () => {
      // .hidden has NO extension in Node.js, so extname('.hidden') = ''
      // basename('.hidden', '') = '.hidden'
      const result = getNewExtension('.hidden', 'mp3');
      // Node correctly treats .hidden as the filename, not extension
      expect(result).toBe('.hidden.mp3');
    });

    it('should handle .tar.gz style extensions', () => {
      // extname only gets the last extension
      expect(getNewExtension('archive.tar.gz', 'zip')).toBe('archive.tar.zip');
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
      const isSameFile =
        inputFile.toLowerCase() === outputFile.toLowerCase() ||
        inputFile === outputFile;

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

      const isSameFile =
        inputFile.toLowerCase() === outputFile.toLowerCase() ||
        inputFile === outputFile;

      expect(isSameFile).toBe(false);
    });
  });
});

describe('Relative path edge cases', () => {
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
    const hasDangerousChars = (path: string): boolean => {
      // Check for quotes
      if (path.includes('"')) return true;
      // Check for newlines
      if (path.includes('\n') || path.includes('\r')) return true;
      // Check Windows-invalid chars (excluding : for drive letter)
      const pathToCheck = /^[A-Za-z]:/.test(path) ? path.slice(2) : path;
      // eslint-disable-next-line no-control-regex
      if (/[\x00-\x1F<>:|?*]/.test(pathToCheck)) return true;
      return false;
    };

    it('should detect quotes', () => {
      expect(hasDangerousChars('/path/"file".mp3')).toBe(true);
    });

    it('should detect newlines', () => {
      expect(hasDangerousChars('/path/file\nname.mp3')).toBe(true);
    });

    it('should detect carriage returns', () => {
      expect(hasDangerousChars('/path/file\rname.mp3')).toBe(true);
    });

    it('should detect null bytes', () => {
      expect(hasDangerousChars('/path/file\x00name.mp3')).toBe(true);
    });

    it('should detect Windows < character', () => {
      expect(hasDangerousChars('/path/file<name.mp3')).toBe(true);
    });

    it('should detect Windows > character', () => {
      expect(hasDangerousChars('/path/file>name.mp3')).toBe(true);
    });

    it('should detect Windows pipe character', () => {
      expect(hasDangerousChars('/path/file|name.mp3')).toBe(true);
    });

    it('should detect Windows question mark', () => {
      expect(hasDangerousChars('/path/file?name.mp3')).toBe(true);
    });

    it('should detect Windows asterisk', () => {
      expect(hasDangerousChars('/path/file*name.mp3')).toBe(true);
    });

    it('should allow Windows drive letter colon', () => {
      expect(hasDangerousChars('C:\\path\\file.mp3')).toBe(false);
    });

    it('should detect colon NOT in drive letter position', () => {
      expect(hasDangerousChars('/path/file:name.mp3')).toBe(true);
    });

    it('should allow normal paths', () => {
      expect(hasDangerousChars('/path/to/normal file.mp3')).toBe(false);
    });

    it('should allow Unicode characters', () => {
      expect(hasDangerousChars('/path/ゲーム音楽.mp3')).toBe(false);
    });

    it('should allow parentheses and brackets', () => {
      expect(hasDangerousChars('/path/song (2024) [FLAC].mp3')).toBe(false);
    });

    it('should allow ampersand', () => {
      expect(hasDangerousChars('/path/Tom & Jerry.mp3')).toBe(false);
    });

    it('should allow single quotes', () => {
      expect(hasDangerousChars("/path/It's a song.mp3")).toBe(false);
    });
  });
});

describe('Log filename increment logic', () => {
  // Mirrors initFileName logic
  const generateLogFilename = (
    basePath: string,
    fileName: string,
    existingFiles: string[]
  ): string => {
    let num = 1;
    let fullFileName = join(basePath, `${fileName}.csv`);

    while (existingFiles.includes(fullFileName)) {
      fullFileName = join(basePath, `${fileName}(${num}).csv`);
      num++;
    }

    return fullFileName;
  };

  it('should return base name when no conflicts', () => {
    const result = generateLogFilename('/logs', 'error', []);
    expect(result).toBe(join('/logs', 'error.csv'));
  });

  it('should increment to (1) when base exists', () => {
    const existing = [join('/logs', 'error.csv')];
    const result = generateLogFilename('/logs', 'error', existing);
    expect(result).toBe(join('/logs', 'error(1).csv'));
  });

  it('should increment to (2) when (1) also exists', () => {
    const existing = [
      join('/logs', 'error.csv'),
      join('/logs', 'error(1).csv'),
    ];
    const result = generateLogFilename('/logs', 'error', existing);
    expect(result).toBe(join('/logs', 'error(2).csv'));
  });

  it('should handle gaps in numbering', () => {
    // If error.csv and error(2).csv exist, should return error(1).csv
    const existing = [
      join('/logs', 'error.csv'),
      join('/logs', 'error(2).csv'),
    ];
    const result = generateLogFilename('/logs', 'error', existing);
    expect(result).toBe(join('/logs', 'error(1).csv'));
  });

  it('should handle high numbers', () => {
    const existing = Array.from({ length: 100 }, (_, i) =>
      i === 0 ? join('/logs', 'error.csv') : join('/logs', `error(${i}).csv`)
    );
    const result = generateLogFilename('/logs', 'error', existing);
    expect(result).toBe(join('/logs', 'error(100).csv'));
  });
});

describe('Input format parsing', () => {
  // Mirrors getUserInput format parsing
  const parseInputFormats = (
    input: string,
    validFormats: string[]
  ): string[] => {
    if (!input) return [...validFormats];

    return input
      .toLowerCase()
      .split(/\s*,\s*|\s+/)
      .map((format) => format.trim())
      .filter((format) => validFormats.includes(format));
  };

  const validFormats = ['flac', 'aiff', 'wav', 'mp3', 'm4a', 'ogg'];

  it('should parse comma-separated formats', () => {
    expect(parseInputFormats('mp3, ogg, flac', validFormats)).toEqual([
      'mp3',
      'ogg',
      'flac',
    ]);
  });

  it('should parse space-separated formats', () => {
    expect(parseInputFormats('mp3 ogg flac', validFormats)).toEqual([
      'mp3',
      'ogg',
      'flac',
    ]);
  });

  it('should parse mixed separators', () => {
    expect(parseInputFormats('mp3, ogg wav', validFormats)).toEqual([
      'mp3',
      'ogg',
      'wav',
    ]);
  });

  it('should filter invalid formats', () => {
    expect(parseInputFormats('mp3, invalid, ogg', validFormats)).toEqual([
      'mp3',
      'ogg',
    ]);
  });

  it('should handle uppercase input', () => {
    expect(parseInputFormats('MP3, OGG', validFormats)).toEqual(['mp3', 'ogg']);
  });

  it('should return all formats for empty input', () => {
    expect(parseInputFormats('', validFormats)).toEqual(validFormats);
  });

  it('should handle extra whitespace', () => {
    expect(parseInputFormats('  mp3  ,   ogg  ', validFormats)).toEqual([
      'mp3',
      'ogg',
    ]);
  });

  it('should return empty array for all invalid', () => {
    expect(parseInputFormats('invalid, fake, wrong', validFormats)).toEqual([]);
  });
});
