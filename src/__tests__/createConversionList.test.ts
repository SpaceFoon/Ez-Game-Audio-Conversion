import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'path';
import {
  defaultCreateConversionListAnswer,
  mockDefaultCreateConversionListAnswers,
} from './test-utils/createConversionListAnswers.js';

// ESM mocks must be declared BEFORE dynamic imports
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => {
  const makeFn = () => {
    const fn = jest.fn((...args: string[]) => args.join(' ')) as jest.Mock & {
      italic: jest.Mock;
      bold: jest.Mock;
    };
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
      redBright: Object.assign(
        jest.fn((a) => a),
        {
          bold: jest.fn((...a) => a.join(' ')),
        }
      ),
      red: Object.assign(
        jest.fn((a) => a),
        { bold: jest.fn((a) => a) }
      ),
      yellow: jest.fn((a) => a),
      gray: jest.fn((a) => a),
    },
    blue: { bold: jest.fn((...a) => a.join(' ')) },
    blueBright: jest.fn((...a) => a.join(' ')),
    green: makeFn(),
    cyanBright: jest.fn((...a) => a.join(' ')),
    cyan: jest.fn((...a) => a.join(' ')),
    redBright: Object.assign(
      jest.fn((a) => a),
      {
        bold: jest.fn((...a) => a.join(' ')),
      }
    ),
    red: Object.assign(
      jest.fn((a) => a),
      { bold: jest.fn((a) => a) }
    ),
    yellow: jest.fn((a) => a),
  };
});

jest.unstable_mockModule('../logger.js', () => ({
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.unstable_mockModule('../utils.js', () => ({
  getAnswer: jest.fn(),
  settings: {},
  handleExit: jest.fn(),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error || 'Unknown error'),
  reportSearchErrors: jest.fn(async () => {}),
}));

// Dynamic imports after mock declarations
const fs = await import('fs');
const { getAnswer, settings, handleExit, reportSearchErrors } =
  await import('../utils.js');
const { default: createConversionList } =
  await import('../createConversionList.js');

const existsSyncMock = fs.existsSync as unknown as jest.MockedFunction<
  typeof fs.existsSync
>;
const mkdirSyncMock = fs.mkdirSync as unknown as jest.MockedFunction<
  typeof fs.mkdirSync
>;
const getAnswerMock = getAnswer as unknown as jest.MockedFunction<
  typeof getAnswer
>;
const handleExitMock = handleExit as unknown as jest.MockedFunction<
  typeof handleExit
>;

describe('createConversionList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settings.inputFilePath = '/input';
    settings.outputFilePath = '/output';
    settings.outputFormats = ['mp3'];
    settings.oggCodec = 'vorbis';
    settings.singleFileMode = false;
    existsSyncMock.mockReturnValue(false);
    mkdirSyncMock.mockImplementation(() => undefined);
    mockDefaultCreateConversionListAnswers(getAnswerMock);
  });

  describe('basic conversion list creation', () => {
    it('creates one output per format for each input file', async () => {
      settings.outputFormats = ['mp3', 'ogg'];
      getAnswerMock.mockImplementation(async (prompt) =>
        defaultCreateConversionListAnswer(prompt)
      );

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
      getAnswerMock.mockImplementation(async (prompt) =>
        defaultCreateConversionListAnswer(prompt)
      );

      const files = [join(settings.inputFilePath, 'subdir', 'song.wav')];
      const result = await createConversionList(files);

      // Output should maintain relative path from input
      expect(result[0].outputFile).toContain(
        join(settings.outputFilePath, 'subdir')
      );
    });

    it('handles multiple input files correctly', async () => {
      getAnswerMock.mockImplementation(async (prompt) =>
        defaultCreateConversionListAnswer(prompt)
      );

      const files = ['a.wav', 'b.wav', 'c.wav'].map((name) =>
        join(settings.inputFilePath, name)
      );
      const result = await createConversionList(files);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.inputFile)).toEqual(files);
    });
  });

  describe('file conflict handling', () => {
    it('applies overwrite-all (oa) to subsequent conflicts', async () => {
      existsSyncMock.mockImplementation(
        (path) =>
          String(path) === join(settings.outputFilePath, 'a.mp3') ||
          String(path) === join(settings.outputFilePath, 'b.mp3')
      );
      getAnswerMock
        .mockResolvedValueOnce('oa')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = ['a.wav', 'b.wav'].map((name) =>
        join(settings.inputFilePath, name)
      );
      const result = await createConversionList(files);

      expect(result).toHaveLength(2);
      expect(result[0].outputFile).toBe(join(settings.outputFilePath, 'a.mp3'));
      expect(result[1].outputFile).toBe(join(settings.outputFilePath, 'b.mp3'));
    });

    it('renames output when user selects [r]ename for existing file', async () => {
      existsSyncMock.mockImplementation(
        (path) => String(path) === join(settings.outputFilePath, 'song.mp3') // Only the original exists
      );
      getAnswerMock
        .mockResolvedValueOnce('r') // rename
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        ); // confirm

      const files = [join(settings.inputFilePath, 'song.wav')];
      const result = await createConversionList(files);

      expect(result[0].outputFile).toContain('-copy(1)');
    });

    it('skips file when user selects [s]kip for existing file', async () => {
      existsSyncMock.mockImplementation(
        (path) => String(path) === join(settings.outputFilePath, 'song.mp3')
      );
      getAnswerMock
        .mockResolvedValueOnce('s') // skip
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        ); // confirm (but no files left)

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      // All files skipped = exit with 0
      expect(handleExitMock).toHaveBeenCalledWith(0);
    });

    it('re-prompts on repeated invalid conflict responses before valid selection', async () => {
      existsSyncMock.mockImplementation(
        (path) => String(path) === join(settings.outputFilePath, 'song.mp3')
      );
      getAnswerMock
        .mockResolvedValueOnce('x') // invalid
        .mockResolvedValueOnce('nope') // invalid
        .mockResolvedValueOnce('r') // valid: rename
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        ); // confirm

      const files = [join(settings.inputFilePath, 'song.wav')];
      const result = await createConversionList(files);

      expect(result[0].outputFile).toContain('-copy(1)');
      // 3 conflict prompts + 1 final confirm = 4 total
      expect(getAnswerMock).toHaveBeenCalledTimes(4);
    });

    it('re-prompts when the user submits an empty conflict response', async () => {
      existsSyncMock.mockImplementation(
        (path) => String(path) === join(settings.outputFilePath, 'song.mp3')
      );
      getAnswerMock
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('r')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const result = await createConversionList([
        join(settings.inputFilePath, 'song.wav'),
      ]);

      expect(result[0].outputFile).toContain('-copy(1)');
      expect(getAnswerMock).toHaveBeenCalledTimes(3);
    });

    it('increments -copy number when -copy(1) already exists (rename depth)', async () => {
      existsSyncMock.mockImplementation((path) => {
        const p = String(path);
        // Original output and copy(1) both exist; copy(2) does not
        return (
          p === join(settings.outputFilePath, 'song.mp3') ||
          p === join(settings.outputFilePath, 'song-copy(1).mp3')
        );
      });
      getAnswerMock
        .mockResolvedValueOnce('r') // rename
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        ); // confirm

      const files = [join(settings.inputFilePath, 'song.wav')];
      const result = await createConversionList(files);

      expect(result[0].outputFile).toContain('-copy(2)');
      expect(result[0].outputFile).not.toContain('-copy(0)');
    });

    it('recurses to the next copy slot when the preferred copy name already exists', async () => {
      existsSyncMock.mockImplementation((path) => {
        const p = String(path);
        return (
          p === join(settings.outputFilePath, 'song.mp3') ||
          p === join(settings.outputFilePath, 'song-copy(1).mp3') ||
          p === join(settings.outputFilePath, 'song-copy(2).mp3')
        );
      });
      getAnswerMock
        .mockResolvedValueOnce('r')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const result = await createConversionList([
        join(settings.inputFilePath, 'song.wav'),
      ]);

      expect(result[0].outputFile).toContain('-copy(3)');
    });

    it('increments from existing -copy(n) basename when renaming conflicts', async () => {
      existsSyncMock.mockImplementation((path) => {
        const p = String(path);
        return p === join(settings.outputFilePath, 'song-copy(5).mp3');
      });
      getAnswerMock
        .mockResolvedValueOnce('r')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join(settings.inputFilePath, 'song-copy(5).wav')];
      const result = await createConversionList(files);

      expect(result[0].outputFile).toContain('-copy(6)');
    });

    it('applies rename-all (ra) to subsequent conflicts', async () => {
      settings.outputFormats = ['mp3'];
      existsSyncMock.mockImplementation(
        (path) =>
          String(path) === join(settings.outputFilePath, 'a.mp3') ||
          String(path) === join(settings.outputFilePath, 'b.mp3')
      );
      getAnswerMock
        .mockResolvedValueOnce('ra')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = ['a.wav', 'b.wav'].map((name) =>
        join(settings.inputFilePath, name)
      );
      const result = await createConversionList(files);

      expect(result[0].outputFile).toContain('-copy');
      expect(result[1].outputFile).toContain('-copy');
    });

    it('applies mixed sticky overwrite then rename-all in one batch', async () => {
      settings.outputFormats = ['mp3'];
      existsSyncMock.mockImplementation((path) => {
        const p = String(path);
        return (
          p === join(settings.outputFilePath, 'a.mp3') ||
          p === join(settings.outputFilePath, 'b.mp3') ||
          p === join(settings.outputFilePath, 'c.mp3')
        );
      });
      getAnswerMock
        .mockResolvedValueOnce('o')
        .mockResolvedValueOnce('ra')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = ['a.wav', 'b.wav', 'c.wav'].map((name) =>
        join(settings.inputFilePath, name)
      );
      const result = await createConversionList(files);

      expect(result).toHaveLength(3);
      expect(result[0].outputFile).toBe(join(settings.outputFilePath, 'a.mp3'));
      expect(result[1].outputFile).toContain('-copy');
      expect(result[2].outputFile).toContain('-copy');
    });

    it('applies skip-all (sa) to subsequent conflicts', async () => {
      existsSyncMock.mockImplementation(
        (path) =>
          String(path) === join(settings.outputFilePath, 'a.mp3') ||
          String(path) === join(settings.outputFilePath, 'b.mp3')
      );
      getAnswerMock
        .mockResolvedValueOnce('sa') // skip all
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = ['a.wav', 'b.wav'].map((name) =>
        join(settings.inputFilePath, name)
      );
      await createConversionList(files);

      // All files skipped = exit
      expect(handleExitMock).toHaveBeenCalledWith(0);
    });

    it('applies overwrite-all (oa) to subsequent conflicts without renaming', async () => {
      settings.outputFormats = ['mp3'];
      existsSyncMock.mockImplementation(
        (path) =>
          String(path) === join(settings.outputFilePath, 'a.mp3') ||
          String(path) === join(settings.outputFilePath, 'b.mp3')
      );
      getAnswerMock
        .mockResolvedValueOnce('oa')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = ['a.wav', 'b.wav'].map((name) =>
        join(settings.inputFilePath, name)
      );
      const result = await createConversionList(files);

      expect(result).toHaveLength(2);
      expect(result[0].outputFile).toBe(join(settings.outputFilePath, 'a.mp3'));
      expect(result[1].outputFile).toBe(join(settings.outputFilePath, 'b.mp3'));
      expect(result.every((item) => !item.outputFile.includes('-copy'))).toBe(
        true
      );
    });
  });

  describe('same file type conversion', () => {
    it('prompts user when input and output are same format', async () => {
      settings.inputFilePath = '/input';
      settings.outputFilePath = '/input'; // Same as input!
      settings.outputFormats = ['mp3'];
      getAnswerMock
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join(settings.inputFilePath, 'song.mp3')]; // Already mp3!
      const result = await createConversionList(files);

      // User said yes, so it should be in list with -copy suffix
      expect(result[0].outputFile).toContain('-copy');
    });

    it('skips same-type conversion when user declines', async () => {
      settings.inputFilePath = '/input';
      settings.outputFilePath = '/input';
      settings.outputFormats = ['mp3'];
      getAnswerMock.mockResolvedValueOnce('no'); // No to same-type conversion

      const files = [join(settings.inputFilePath, 'song.mp3')];
      await createConversionList(files);

      // No files to convert → exit
      expect(handleExitMock).toHaveBeenCalledWith(0);
    });

    it('re-prompts on invalid same-type answers before accepting yes', async () => {
      settings.inputFilePath = '/input';
      settings.outputFilePath = '/input';
      settings.outputFormats = ['mp3'];
      getAnswerMock
        .mockResolvedValueOnce('maybe')
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join(settings.inputFilePath, 'song.mp3')];
      const result = await createConversionList(files);

      expect(result[0].outputFile).toContain('-copy');
      expect(getAnswerMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('ogg codec selection', () => {
    it('prompts for ogg codec when not set and ogg is an output format', async () => {
      settings.outputFormats = ['ogg'];
      settings.oggCodec = null;
      getAnswerMock
        .mockResolvedValueOnce('opus') // codec selection
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        ); // confirm

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(settings.oggCodec).toBe('opus');
    });

    it('defaults to vorbis when user enters empty string for codec', async () => {
      settings.outputFormats = ['ogg'];
      settings.oggCodec = null;
      getAnswerMock
        .mockResolvedValueOnce('') // empty = vorbis default
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(settings.oggCodec).toBe('vorbis');
    });

    it('trims whitespace from ogg codec answers', async () => {
      settings.outputFormats = ['ogg'];
      settings.oggCodec = null;
      getAnswerMock
        .mockResolvedValueOnce('  opus  ')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(settings.oggCodec).toBe('opus');
    });

    it('re-prompts on invalid codec input until valid', async () => {
      settings.outputFormats = ['ogg'];
      settings.oggCodec = null;
      getAnswerMock
        .mockResolvedValueOnce('invalid')
        .mockResolvedValueOnce('also-invalid')
        .mockResolvedValueOnce('vorbis')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(settings.oggCodec).toBe('vorbis');
      // getAnswer called 3 times for codec + 1 for confirm = 4 total
      expect(getAnswerMock).toHaveBeenCalledTimes(4);
    });

    it('prompts again when a stale codec was set by a previous batch', async () => {
      settings.outputFormats = ['ogg'];
      settings.oggCodec = 'opus';
      getAnswerMock
        .mockResolvedValueOnce('vorbis')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(settings.oggCodec).toBe('vorbis');
      expect(getAnswerMock).toHaveBeenCalledWith(
        expect.stringMatching(/Vorbis or Opus/i)
      );
    });
  });

  describe('final confirmation', () => {
    it('returns conversion list when user confirms with yes', async () => {
      getAnswerMock.mockImplementation(async (prompt) =>
        defaultCreateConversionListAnswer(prompt)
      );

      const files = [join(settings.inputFilePath, 'song.wav')];
      const result = await createConversionList(files);

      expect(result).toHaveLength(1);
      expect(handleExitMock).not.toHaveBeenCalled();
    });

    it('exits when user declines final confirmation', async () => {
      getAnswerMock.mockResolvedValue('no');

      const files = [join(settings.inputFilePath, 'song.wav')];
      await createConversionList(files);

      expect(handleExitMock).toHaveBeenCalledWith(0);
    });

    it('re-prompts on invalid confirmation input', async () => {
      getAnswerMock
        .mockResolvedValueOnce('maybe') // invalid
        .mockResolvedValueOnce('sure') // invalid
        .mockResolvedValueOnce('yes'); // valid

      const files = [join(settings.inputFilePath, 'song.wav')];
      const result = await createConversionList(files);

      expect(result).toHaveLength(1);
      expect(getAnswerMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('exits with error when no input files provided', async () => {
      const files: string[] = [];
      await createConversionList(files);

      expect(reportSearchErrors).toHaveBeenCalled();
      expect(handleExitMock).toHaveBeenCalledWith(1);
    });

    it('continues when preparing one output directory fails', async () => {
      settings.inputFilePath = '/input';
      settings.outputFilePath = '/output';
      mkdirSyncMock.mockImplementation((dir) => {
        if (String(dir).includes('bad')) {
          throw new Error('mkdir failed');
        }
      });
      getAnswerMock.mockImplementation(async (prompt) =>
        defaultCreateConversionListAnswer(prompt)
      );

      const files = [
        join(settings.inputFilePath, 'good', 'song.wav'),
        join(settings.inputFilePath, 'bad', 'song.wav'),
      ];
      const result = await createConversionList(files);

      expect(result).toHaveLength(2);
      expect(mkdirSyncMock).toHaveBeenCalled();
    });

    it('deduplicates duplicate output targets before returning the final list', async () => {
      getAnswerMock.mockImplementation(async (prompt) =>
        defaultCreateConversionListAnswer(prompt)
      );

      const duplicateFile = join(settings.inputFilePath, 'song.wav');
      const result = await createConversionList([duplicateFile, duplicateFile]);

      expect(result).toEqual([
        {
          inputFile: duplicateFile,
          outputFile: join(settings.outputFilePath, 'song.mp3'),
          outputFormat: 'mp3',
        },
      ]);
    });

    it('keeps existing and non-conflicting outputs together in mixed-format batches', async () => {
      settings.outputFormats = ['mp3', 'ogg'];
      existsSyncMock.mockImplementation(
        (path) => String(path) === join(settings.outputFilePath, 'song.mp3')
      );
      getAnswerMock
        .mockResolvedValueOnce('vorbis')
        .mockResolvedValueOnce('r')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const result = await createConversionList([
        join(settings.inputFilePath, 'song.wav'),
      ]);

      expect(result).toHaveLength(2);
      expect(
        result.some((file) => file.outputFile.endsWith('song-copy(1).mp3'))
      ).toBe(true);
      expect(result.some((file) => file.outputFile.endsWith('song.ogg'))).toBe(
        true
      );
    });

    // Note: Directory creation failure is difficult to test with ESM mocks
    // because the error is caught inline and handleExit doesn't stop execution.
    // This scenario is tested manually or in integration tests.
  });
});
