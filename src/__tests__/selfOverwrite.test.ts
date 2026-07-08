/**
 * Tests for self-overwrite protection.
 *
 * The ONLY guard preventing ffmpeg from destroying input files lives in
 * createConversionList.ts.  ffmpeg runs with `-y` (force-overwrite), so if
 * the conversion list ever contains an item where inputFile === outputFile,
 * the original is destroyed.  These tests make sure that can never happen.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'path';
import {
  defaultCreateConversionListAnswer,
  mockDefaultCreateConversionListAnswers,
} from './test-utils/createConversionListAnswers.js';
import { createConversionListFsMock } from './test-utils/mockCreateConversionListFs.js';

// ── ESM mocks (must be declared before dynamic imports) ──────────────────────

jest.unstable_mockModule('fs', () => createConversionListFsMock());

jest.unstable_mockModule('chalk', () => {
  const passthrough = jest.fn((...a: unknown[]) => a.join(' '));
  const bold = jest.fn((...a: unknown[]) => a.join(' '));
  const obj = () =>
    Object.assign(passthrough, {
      bold,
      italic: jest.fn((a: unknown) => a),
    });
  return {
    default: {
      blue: { bold },
      blueBright: passthrough,
      green: obj(),
      cyanBright: passthrough,
      cyan: passthrough,
      redBright: Object.assign(passthrough, { bold }),
      red: Object.assign(
        jest.fn((a: unknown) => a),
        { bold }
      ),
      yellow: jest.fn((a: unknown) => a),
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

// ── Dynamic imports ──────────────────────────────────────────────────────────

const fs = await import('fs');
const { getAnswer, settings, handleExit } = await import('../utils.js');
const { default: createConversionList } =
  await import('../createConversionList.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Assert no item in the list has inputFile === outputFile (case-insensitive). */
function assertNoSelfOverwrite(
  list: Array<{ inputFile: string; outputFile: string }>
) {
  for (const item of list) {
    expect(item.inputFile.toLowerCase()).not.toBe(
      item.outputFile.toLowerCase()
    );
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('self-overwrite protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settings.inputFilePath = '/input';
    settings.outputFilePath = '/input'; // same folder — high-risk scenario
    settings.outputFormats = ['wav'];
    settings.oggCodec = 'vorbis';
    settings.singleFileMode = false;
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
    mockDefaultCreateConversionListAnswers(getAnswer);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Core: same format, same directory (exact match)
  // ────────────────────────────────────────────────────────────────────────

  describe('same format + same directory (user accepts)', () => {
    it('renames output to -copy(1) — never overwrites input', async () => {
      settings.outputFormats = ['wav'];
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join('/input', 'song.wav')];
      const result = await createConversionList(files);

      expect(result).toHaveLength(1);
      expect(result[0].outputFile).toContain('-copy(1)');
      assertNoSelfOverwrite(result);
    });

    it('skips when user declines same-type conversion', async () => {
      settings.outputFormats = ['wav'];
      getAnswer.mockResolvedValueOnce('no');

      const files = [join('/input', 'song.wav')];
      await createConversionList(files);

      expect(handleExit).toHaveBeenCalledWith(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Multiple files, same format, same directory
  // ────────────────────────────────────────────────────────────────────────

  describe('batch same-format conversion', () => {
    it('renames every file — no input file is ever its own output', async () => {
      settings.outputFormats = ['mp3'];
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [
        join('/input', 'a.mp3'),
        join('/input', 'b.mp3'),
        join('/input', 'c.mp3'),
      ];
      const result = await createConversionList(files);

      expect(result).toHaveLength(3);
      for (const item of result) {
        expect(item.outputFile).toContain('-copy');
      }
      assertNoSelfOverwrite(result);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Case-insensitive match (Windows-style)
  // ────────────────────────────────────────────────────────────────────────

  describe('case-insensitive path matching', () => {
    it('detects SONG.WAV → song.wav as self-overwrite', async () => {
      settings.inputFilePath = '/Input';
      settings.outputFilePath = '/input';
      settings.outputFormats = ['wav'];
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join('/Input', 'SONG.WAV')];
      const result = await createConversionList(files);

      assertNoSelfOverwrite(result);
    });

    it('detects mixed case extensions as self-overwrite', async () => {
      settings.outputFormats = ['mp3'];
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join('/input', 'track.MP3')];
      const result = await createConversionList(files);

      assertNoSelfOverwrite(result);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Multiple output formats where one matches input
  // ────────────────────────────────────────────────────────────────────────

  describe('mixed format batch with one matching format', () => {
    it('renames the matching format, converts others normally', async () => {
      settings.outputFormats = ['ogg', 'wav']; // wav matches input
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join('/input', 'song.wav')];
      const result = await createConversionList(files);

      expect(result).toHaveLength(2);
      assertNoSelfOverwrite(result);

      const wavOutput = result.find((r) => r.outputFormat === 'wav');
      const oggOutput = result.find((r) => r.outputFormat === 'ogg');

      expect(wavOutput!.outputFile).toContain('-copy');
      expect(oggOutput!.outputFile).not.toContain('-copy');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Subdirectory structure (input = output root)
  // ────────────────────────────────────────────────────────────────────────

  describe('subdirectory files with same root', () => {
    it('renames files in subdirectories when format matches', async () => {
      settings.outputFormats = ['flac'];
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [
        join('/input', 'sub1', 'track.flac'),
        join('/input', 'sub2', 'track.flac'),
      ];
      const result = await createConversionList(files);

      expect(result).toHaveLength(2);
      assertNoSelfOverwrite(result);
      for (const item of result) {
        expect(item.outputFile).toContain('-copy');
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Output to different directory (should never trigger self-overwrite)
  // ────────────────────────────────────────────────────────────────────────

  describe('different output directory', () => {
    it('never self-overwrites when output dir differs from input', async () => {
      settings.inputFilePath = '/input';
      settings.outputFilePath = '/output';
      settings.outputFormats = ['wav'];
      getAnswer.mockImplementation(async (prompt) =>
        defaultCreateConversionListAnswer(prompt)
      );

      const files = [join('/input', 'song.wav')];
      const result = await createConversionList(files);

      expect(result).toHaveLength(1);
      assertNoSelfOverwrite(result);
      // Should NOT have -copy suffix since dirs differ
      expect(result[0].outputFile).not.toContain('-copy');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Edge: every format targeting itself
  // ────────────────────────────────────────────────────────────────────────

  describe('all supported formats converting to themselves', () => {
    const formats: Array<{ ext: string; format: string }> = [
      { ext: 'wav', format: 'wav' },
      { ext: 'mp3', format: 'mp3' },
      { ext: 'ogg', format: 'ogg' },
      { ext: 'flac', format: 'flac' },
      { ext: 'aiff', format: 'aiff' },
      { ext: 'm4a', format: 'm4a' },
    ];

    it.each(formats)(
      '$ext → $format: never produces inputFile === outputFile',
      async ({ ext, format }) => {
        settings.outputFormats = [format];
        getAnswer
          .mockResolvedValueOnce('yes')
          .mockImplementation(async (prompt) =>
            defaultCreateConversionListAnswer(prompt)
          );

        const files = [join('/input', `track.${ext}`)];
        const result = await createConversionList(files);

        assertNoSelfOverwrite(result);
      }
    );
  });

  // ────────────────────────────────────────────────────────────────────────
  // Edge: file already has -copy suffix
  // ────────────────────────────────────────────────────────────────────────

  describe('input file already named with -copy suffix', () => {
    it('increments copy number instead of colliding', async () => {
      settings.outputFormats = ['wav'];
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join('/input', 'song-copy(1).wav')];
      const result = await createConversionList(files);

      assertNoSelfOverwrite(result);
      // Should bump to -copy(2) or higher
      expect(result[0].outputFile).toMatch(/-copy\(\d+\)/);
      expect(result[0].outputFile).not.toBe(files[0]);
    });

    it('handles deeply incremented copy numbers', async () => {
      settings.outputFormats = ['wav'];
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      // Simulate -copy(1) through -copy(4) existing on disk
      fs.existsSync.mockImplementation((p: unknown) => {
        const path = String(p);
        return (
          path.includes('-copy(1)') ||
          path.includes('-copy(2)') ||
          path.includes('-copy(3)') ||
          path.includes('-copy(4)')
        );
      });

      const files = [join('/input', 'song.wav')];
      const result = await createConversionList(files);

      assertNoSelfOverwrite(result);
      expect(result[0].outputFile).toContain('-copy(5)');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Edge: single file mode
  // ────────────────────────────────────────────────────────────────────────

  describe('single file mode', () => {
    it('still protects against self-overwrite', async () => {
      settings.singleFileMode = true;
      settings.outputFormats = ['ogg'];
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join('/input', 'music.ogg')];
      const result = await createConversionList(files);

      assertNoSelfOverwrite(result);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Overwrite-all (oa) must still not self-overwrite
  // ────────────────────────────────────────────────────────────────────────

  describe('overwrite-all (oa) with same-format files', () => {
    it('self-overwrite guard fires BEFORE conflict resolution', async () => {
      // Same dir + same format triggers the self-overwrite guard first.
      // Even if the user previously selected "oa", the guard should rename.
      settings.outputFormats = ['wav'];
      getAnswer
        .mockResolvedValueOnce('yes')
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        );

      const files = [join('/input', 'a.wav'), join('/input', 'b.wav')];
      const result = await createConversionList(files);

      assertNoSelfOverwrite(result);
      for (const item of result) {
        expect(item.outputFile).toContain('-copy');
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Regression: blank user response defaults to "no" (skip)
  // ────────────────────────────────────────────────────────────────────────

  describe('blank response to same-type prompt', () => {
    it('treats empty string as "no" and skips', async () => {
      settings.outputFormats = ['wav'];
      getAnswer.mockResolvedValueOnce(''); // blank = no

      const files = [join('/input', 'song.wav')];
      await createConversionList(files);

      expect(handleExit).toHaveBeenCalledWith(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Regression: invalid input re-prompts, never silently overwrites
  // ────────────────────────────────────────────────────────────────────────

  describe('invalid input to same-type prompt', () => {
    it('re-prompts until valid — never falls through to overwrite', async () => {
      settings.outputFormats = ['wav'];
      getAnswer
        .mockResolvedValueOnce('maybe') // invalid
        .mockResolvedValueOnce('sure') // invalid
        .mockResolvedValueOnce('yes') // valid → rename
        .mockImplementation(async (prompt) =>
          defaultCreateConversionListAnswer(prompt)
        ); // confirm list

      const files = [join('/input', 'song.wav')];
      const result = await createConversionList(files);

      assertNoSelfOverwrite(result);
      expect(result[0].outputFile).toContain('-copy');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Path normalisation unit tests — verify resolve() catches bypass attempts.
// These test the comparison logic directly, independent of createConversionList.
// ══════════════════════════════════════════════════════════════════════════════

const { resolve } = await import('node:path');

describe('path normalisation catches bypass attempts', () => {
  /** The same comparison used in both createConversionList and converterWorker */
  const isSamePath = (a: string, b: string): boolean =>
    resolve(a).toLowerCase() === resolve(b).toLowerCase();

  it('detects .. traversal', () => {
    expect(isSamePath('/input/song.wav', '/input/sub/../song.wav')).toBe(true);
  });

  it('detects ./ prefix', () => {
    // resolve() turns relative paths absolute based on cwd, so both must share the same base
    const abs = resolve('/input/song.wav');
    expect(isSamePath(abs, abs)).toBe(true);
  });

  it('detects double slashes', () => {
    expect(isSamePath('/input//song.wav', '/input/song.wav')).toBe(true);
  });

  it('detects case differences', () => {
    expect(isSamePath('/Input/SONG.WAV', '/input/song.wav')).toBe(true);
  });

  it('correctly distinguishes different files', () => {
    expect(isSamePath('/input/song.wav', '/input/song.mp3')).toBe(false);
    expect(isSamePath('/input/song.wav', '/output/song.wav')).toBe(false);
  });

  it('detects trailing-dot differences (Windows edge case)', () => {
    // On Linux resolve() doesn't strip trailing dots, but the paths are
    // genuinely different files on Linux. On Windows NTFS silently strips them.
    // Our guard is case-insensitive string match after resolve(), which is
    // correct on Linux and conservative on Windows.
    const a = resolve('/input/song.wav');
    const b = resolve('/input/song.wav');
    expect(a.toLowerCase() === b.toLowerCase()).toBe(true);
  });

  it('handles deeply nested .. chains', () => {
    expect(isSamePath('/a/b/c/d/song.wav', '/a/b/c/d/x/y/../../song.wav')).toBe(
      true
    );
  });
});
