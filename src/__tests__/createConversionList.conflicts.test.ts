/**
 * Regression tests for conflict-resolution bugs in createConversionList:
 *  - declining same-type conversion must not be overridden by the
 *    existing-file conflict prompt (or a prior "ra" answer)
 *  - rename must not assign the same -copy(n) name to two outputs in one batch
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'path';
import {
  createConversionListFsMock,
  mockExistingFilesInDir,
} from './test-utils/mockCreateConversionListFs.js';

jest.unstable_mockModule('fs', () => createConversionListFsMock());

jest.unstable_mockModule('chalk', () => {
  const passthrough = jest.fn((...a: unknown[]) => a.join(' '));
  const bold = jest.fn((...a: unknown[]) => a.join(' '));
  return {
    default: {
      blue: { bold },
      blueBright: passthrough,
      green: Object.assign(passthrough, {
        bold,
        italic: jest.fn((a: unknown) => a),
      }),
      cyanBright: passthrough,
      cyan: passthrough,
      gray: passthrough,
      redBright: Object.assign(passthrough, { bold }),
      red: Object.assign(
        jest.fn((a: unknown) => a),
        { bold }
      ),
      yellow: jest.fn((...a: unknown[]) => a.join(' ')),
    },
  };
});

jest.unstable_mockModule('../utils.js', () => ({
  getAnswer: jest.fn(),
  settings: {},
  handleExit: jest.fn(),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error || 'Unknown error'),
  reportSearchErrors: jest.fn(async () => {}),
}));

const fs = await import('fs');
const { getAnswer, settings } = await import('../utils.js');
const { default: createConversionList } =
  await import('../createConversionList.js');

const getAnswerMock = getAnswer as unknown as jest.Mock<
  (prompt?: unknown) => Promise<string>
>;

const isSelfPrompt = (p: unknown) => /same file type/i.test(String(p));
const isConflictPrompt = (p: unknown) => /\[O\]verwrite/i.test(String(p));

/** Answer prompts by type; returns the list of prompt kinds seen. */
const answerPrompts = (answers: {
  self?: string;
  conflict?: string[];
}): string[] => {
  const seen: string[] = [];
  const conflictAnswers = [...(answers.conflict ?? [])];
  getAnswerMock.mockImplementation(async (prompt) => {
    if (isSelfPrompt(prompt)) {
      seen.push('self');
      return answers.self ?? 'no';
    }
    if (isConflictPrompt(prompt)) {
      seen.push('conflict');
      return conflictAnswers.shift() ?? 's';
    }
    seen.push('other');
    return 'yes';
  });
  return seen;
};

describe('createConversionList conflict handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settings.oggCodec = 'vorbis';
    settings.singleFileMode = false;
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
  });

  describe('declining same-type conversion', () => {
    beforeEach(() => {
      settings.inputFilePath = '/input';
      settings.outputFilePath = '/input';
      settings.outputFormats = ['wav'];
    });

    it('does not show an overwrite/rename prompt for the skipped input', async () => {
      mockExistingFilesInDir(fs.readdirSync, fs.statSync, '/input', [
        'song.wav',
      ]);
      const seen = answerPrompts({ self: 'no', conflict: ['r'] });

      const result = await createConversionList([join('/input', 'song.wav')]);

      expect(seen).not.toContain('conflict');
      expect(result).toEqual([]);
    });

    it('is not overridden by an earlier "rename all" answer', async () => {
      mockExistingFilesInDir(fs.readdirSync, fs.statSync, '/input', [
        'other.flac',
        'other.wav',
        'song.wav',
      ]);
      answerPrompts({ self: 'no', conflict: ['ra'] });

      const result = await createConversionList([
        join('/input', 'other.flac'),
        join('/input', 'song.wav'),
      ]);

      expect(result.map((r) => r.inputFile)).toEqual([
        join('/input', 'other.flac'),
      ]);
      expect(result[0]?.outputFile).toBe(join('/input', 'other-copy(1).wav'));
    });
  });

  describe('rename within a batch', () => {
    beforeEach(() => {
      settings.inputFilePath = '/in';
      settings.outputFilePath = '/out';
      settings.outputFormats = ['mp3'];
      mockExistingFilesInDir(fs.readdirSync, fs.statSync, '/out', ['song.mp3']);
    });

    it('"ra" gives each conflicting output its own copy name', async () => {
      answerPrompts({ conflict: ['ra'] });

      const result = await createConversionList([
        join('/in', 'song.wav'),
        join('/in', 'song.flac'),
      ]);

      expect(result).toHaveLength(2);
      const outputs = result.map((r) => r.outputFile).sort();
      expect(outputs).toEqual([
        join('/out', 'song-copy(1).mp3'),
        join('/out', 'song-copy(2).mp3'),
      ]);
    });

    it('"r" on each conflict gives distinct copy names', async () => {
      answerPrompts({ conflict: ['r', 'r'] });

      const result = await createConversionList([
        join('/in', 'song.wav'),
        join('/in', 'song.flac'),
      ]);

      expect(result).toHaveLength(2);
      expect(new Set(result.map((r) => r.outputFile)).size).toBe(2);
    });
  });
});
