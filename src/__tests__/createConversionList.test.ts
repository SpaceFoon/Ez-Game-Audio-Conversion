import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'path';

// ESM mocks must be declared BEFORE dynamic imports
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => {
  const makeFn = (_impl = (a) => (Array.isArray(a) ? a.join(' ') : a)) => {
    const fn = jest.fn((...args) => args.join(' '));
    fn.italic = jest.fn((a) => a);
    fn.bold = jest.fn((a) => a);
    return fn;
  };

  return {
    default: {
      blue: { bold: jest.fn((...a) => a.join(' ')) },
      blueBright: jest.fn((...a) => a.join(' ')),
      green: makeFn(),
      cyanBright: jest.fn((...a) => a.join(' ')),
      cyan: jest.fn((...a) => a.join(' ')),
      redBright: jest.fn((a) => a),
      red: Object.assign(
        jest.fn((a) => a),
        { bold: jest.fn((a) => a) }
      ),
      yellow: jest.fn((a) => a),
    },
    blue: { bold: jest.fn((...a) => a.join(' ')) },
    blueBright: jest.fn((...a) => a.join(' ')),
    green: makeFn(),
    cyanBright: jest.fn((...a) => a.join(' ')),
    cyan: jest.fn((...a) => a.join(' ')),
    redBright: jest.fn((a) => a),
    red: Object.assign(
      jest.fn((a) => a),
      { bold: jest.fn((a) => a) }
    ),
    yellow: jest.fn((a) => a),
  };
});

jest.unstable_mockModule('../utils.js', () => ({
  getAnswer: jest.fn(),
  settings: {},
  handleExit: jest.fn(),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error || 'Unknown error'),
}));

// Dynamic imports after mock declarations
const fs = await import('fs');
const { getAnswer, settings, handleExit } = await import('../utils.js');
const { default: createConversionList } =
  await import('../createConversionList.js');

describe('createConversionList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settings.inputFilePath = '/input';
    settings.outputFilePath = '/output';
    settings.outputFormats = ['mp3'];
    settings.oggCodec = 'vorbis';
    settings.singleFileMode = false;
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
  });

  describe('basic conversion list creation', () => {
    it('creates one output per format for each input file', async () => {
      settings.outputFormats = ['mp3', 'ogg'];
      getAnswer.mockResolvedValue('yes');

      const files = [join(settings.inputFilePath, 'song.wav')];
      const result = await createConversionList(files);

      // 1 input file × 2 formats = 2 outputs
      expect(result).toHaveLength(2);
      expect(result[0].inputFile).toBe(
        join(settings.inputFilePath, 'song.wav')
      );
      expect(result[0].outputFile).toContain('.mp3');
      expect(result[1].outputFile).toContain('.ogg');
    });

    it('preserves directory structure in output paths', async () => {
      settings.inputFilePath = '/input';
      settings.outputFilePath = '/output';
      getAnswer.mockResolvedValue('yes');

      const files = [join(settings.inputFilePath, 'subdir', 'song.wav')];
      const result = await createConversionList(files);

      // Output should maintain relative path from input
      expect(result[0].outputFile).toContain(
        join(settings.outputFilePath, 'subdir')
      );
    });

    it('handles multiple input files correctly', async () => {
      getAnswer.mockResolvedValue('yes');

      const files = ['a.wav', 'b.wav', 'c.wav'].map((name) =>
        join(settings.inputFilePath, name)
      );
      const result = await createConversionList(files);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.inputFile)).toEqual(files);
    });
  });

  describe('file conflict handling', () => {
    it('renames output when user selects [r]ename for existing file', async () => {
      fs.existsSync.mockImplementation(
        (path) => path === join(settings.outputFilePath, 'song.mp3') // Only the original exists
      );
      getAnswer
        .mockResolvedValueOnce('r') // rename
        .mockResolvedValue('yes'); // confirm

      const files = [join(settings.inputFilePath, 'song.wav')];
      const result = await createConversionList(files);

      expect(result[0].outputFile).toContain('-copy(1)');
    });

    it('skips file when user selects [s]kip for existing file', async () => {
      fs.existsSync.mockImplementation(
        (path) => path === join(settings.outputFilePath, 'song.mp3')
      );
      getAnswer
        .mockResolvedValueOnce('s') // skip
        .mockResolvedValue('yes'); // confirm (but no files left)

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      // All files skipped = exit with 0
      expect(handleExit).toHaveBeenCalledWith(0);
    });

    it('applies rename-all (ra) to subsequent conflicts', async () => {
      settings.outputFormats = ['mp3'];
      // Both output files exist
      fs.existsSync.mockImplementation(
        (path) =>
          path === join(settings.outputFilePath, 'a.mp3') ||
          path === join(settings.outputFilePath, 'b.mp3')
      );
      getAnswer
        .mockResolvedValueOnce('ra') // rename all
        .mockResolvedValue('yes'); // confirm

      const files = ['a.wav', 'b.wav'].map((name) =>
        join(settings.inputFilePath, name)
      );
      const result = await createConversionList(files);

      // Both should be renamed
      expect(result[0].outputFile).toContain('-copy');
      expect(result[1].outputFile).toContain('-copy');
    });

    it('applies skip-all (sa) to subsequent conflicts', async () => {
      fs.existsSync.mockImplementation(
        (path) =>
          path === join(settings.outputFilePath, 'a.mp3') ||
          path === join(settings.outputFilePath, 'b.mp3')
      );
      getAnswer
        .mockResolvedValueOnce('sa') // skip all
        .mockResolvedValue('yes');

      const files = ['a.wav', 'b.wav'].map((name) =>
        join(settings.inputFilePath, name)
      );
      await createConversionList(files);

      // All files skipped = exit
      expect(handleExit).toHaveBeenCalledWith(0);
    });
  });

  describe('same file type conversion', () => {
    it('prompts user when input and output are same format', async () => {
      settings.inputFilePath = '/input';
      settings.outputFilePath = '/input'; // Same as input!
      settings.outputFormats = ['mp3'];
      getAnswer.mockResolvedValueOnce('yes').mockResolvedValue('yes');

      const files = [join(settings.inputFilePath, 'song.mp3')]; // Already mp3!
      const result = await createConversionList(files);

      // User said yes, so it should be in list with -copy suffix
      expect(result[0].outputFile).toContain('-copy');
    });

    it('skips same-type conversion when user declines', async () => {
      settings.inputFilePath = '/input';
      settings.outputFilePath = '/input';
      settings.outputFormats = ['mp3'];
      getAnswer.mockResolvedValueOnce('no'); // No to same-type conversion

      const files = [join(settings.inputFilePath, 'song.mp3')];
      await createConversionList(files);

      // No files to convert → exit
      expect(handleExit).toHaveBeenCalledWith(0);
    });
  });

  describe('ogg codec selection', () => {
    it('prompts for ogg codec when not set and ogg is an output format', async () => {
      settings.outputFormats = ['ogg'];
      settings.oggCodec = undefined;
      getAnswer
        .mockResolvedValueOnce('opus') // codec selection
        .mockResolvedValue('yes'); // confirm

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(settings.oggCodec).toBe('opus');
    });

    it('defaults to vorbis when user enters empty string for codec', async () => {
      settings.outputFormats = ['ogg'];
      settings.oggCodec = undefined;
      getAnswer
        .mockResolvedValueOnce('') // empty = vorbis default
        .mockResolvedValue('yes');

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(settings.oggCodec).toBe('vorbis');
    });

    it('re-prompts on invalid codec input until valid', async () => {
      settings.outputFormats = ['ogg'];
      settings.oggCodec = undefined;
      getAnswer
        .mockResolvedValueOnce('invalid')
        .mockResolvedValueOnce('also-invalid')
        .mockResolvedValueOnce('vorbis')
        .mockResolvedValue('yes');

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(settings.oggCodec).toBe('vorbis');
      // getAnswer called 3 times for codec + 1 for confirm = 4 total
      expect(getAnswer).toHaveBeenCalledTimes(4);
    });
  });

  describe('final confirmation', () => {
    it('returns conversion list when user confirms with yes', async () => {
      getAnswer.mockResolvedValue('yes');

      const files = [join(settings.inputFilePath, 'song.wav')];
      const result = await createConversionList(files);

      expect(result).toHaveLength(1);
      expect(handleExit).not.toHaveBeenCalled();
    });

    it('exits when user declines final confirmation', async () => {
      getAnswer.mockResolvedValue('no');

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(handleExit).toHaveBeenCalledWith(0);
    });

    it('re-prompts on invalid confirmation input', async () => {
      getAnswer
        .mockResolvedValueOnce('maybe') // invalid
        .mockResolvedValueOnce('sure') // invalid
        .mockResolvedValueOnce('yes'); // valid

      const files = [join(settings.inputFilePath, 'song.wav')];
      const result = await createConversionList(files);

      expect(result).toHaveLength(1);
      expect(getAnswer).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('exits with error when no input files provided', async () => {
      const files = [];
      await createConversionList(files);

      expect(handleExit).toHaveBeenCalledWith(1);
    });

    // Note: Directory creation failure is difficult to test with ESM mocks
    // because the error is caught inline and handleExit doesn't stop execution.
    // This scenario is tested manually or in integration tests.
  });
});
