/**
 * Consolidated characterization tests for known production behaviors and open bugs.
 * Search test output for [KNOWN BUG] or [AUDIT] to find documented issues.
 *
 * Fixed items (KB-001..003) live in dedicated audit files; this file tracks
 * remaining gaps and desired future behavior via it.failing().
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'path';
import { mockDefaultCreateConversionListAnswers } from './test-utils/createConversionListAnswers.js';

jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => {
  const makeFn = () => {
    const fn = jest.fn((...parts: string[]) => parts.join(' ')) as jest.Mock & {
      italic: jest.Mock;
      bold: jest.Mock;
    };
    fn.italic = jest.fn((text: string) => text);
    fn.bold = jest.fn((text: string) => text);
    return fn;
  };

  const chalkMock = {
    blue: { bold: jest.fn((...parts: string[]) => parts.join(' ')) },
    blueBright: jest.fn((...parts: string[]) => parts.join(' ')),
    green: makeFn(),
    cyanBright: jest.fn((...parts: string[]) => parts.join(' ')),
    cyan: jest.fn((...parts: string[]) => parts.join(' ')),
    redBright: Object.assign(
      jest.fn((text: string) => text),
      {
        bold: jest.fn((...parts: string[]) => parts.join(' ')),
      }
    ),
    red: Object.assign(
      jest.fn((text: string) => text),
      {
        bold: jest.fn((text: string) => text),
      }
    ),
    yellow: jest.fn((text: string) => text),
    gray: jest.fn((text: string) => text),
  };

  return { default: chalkMock, ...chalkMock };
});

jest.unstable_mockModule('../utils.js', () => ({
  getAnswer: jest.fn(),
  settings: {},
  handleExit: jest.fn(),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  reportSearchErrors: jest.fn(async () => {}),
}));

const fs = await import('fs');
const { getAnswer, settings } = await import('../utils.js');
const { default: createConversionList } =
  await import('../createConversionList.js');
const { getRelativeOutputDir } = await import('../createConversionList.js');

const existsSyncMock = fs.existsSync as unknown as jest.MockedFunction<
  typeof fs.existsSync
>;
const getAnswerMock = getAnswer as unknown as jest.MockedFunction<
  typeof getAnswer
>;

describe('knownBugs characterization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settings.inputFilePath = '/input-root';
    settings.outputFilePath = '/output-root';
    settings.outputFormats = ['mp3'];
    settings.oggCodec = 'vorbis';
    settings.singleFileMode = false;
    existsSyncMock.mockReturnValue(false);
    mockDefaultCreateConversionListAnswers(getAnswerMock);
  });

  describe('duplicate output collision', () => {
    it('keeps the first input, drops the colliding one, and warns about it', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const firstInput = '/outside-a/song.wav';
      const secondInput = '/outside-b/song.wav';

      const result = await createConversionList([firstInput, secondInput]);

      // Both inputs map to /output-root/song.mp3; only the first survives...
      expect(result).toHaveLength(1);
      expect(result[0]?.inputFile).toBe(firstInput);
      expect(
        result.find((item) => item.inputFile === secondInput)
      ).toBeUndefined();

      // ...and the user is told the second input was skipped (no silent drop).
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/duplicate output|Skipping duplicate/i)
      );

      warnSpy.mockRestore();
    });
  });

  describe('[AUDIT] getRelativeOutputDir path escape', () => {
    it('falls back to output root when input file is outside input root', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const rel = getRelativeOutputDir('/input-root', '/other-root/song.wav');

      expect(rel).toBe('');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not preserve folder structure')
      );

      warnSpy.mockRestore();
    });

    it('preserves subdirectory when file is under input root', () => {
      const rel = getRelativeOutputDir(
        '/input-root',
        join('/input-root', 'album', 'song.wav')
      );

      expect(rel).toBe('album');
    });
  });
});
