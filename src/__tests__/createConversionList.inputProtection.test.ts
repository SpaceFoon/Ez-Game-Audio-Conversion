/**
 * An existing output that is also one of this batch's input files must never
 * be overwritten, even after "o"/"oa" — it is renamed instead. Plus cosmetic
 * prompt fixes: "YES" is accepted without a warning, and "oa" only announces
 * an overwrite for outputs that actually exist.
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
        jest.fn((...a: unknown[]) => a.join(' ')),
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
  getErrorMessage: (e: unknown) => String(e),
  reportSearchErrors: jest.fn(async () => {}),
}));

const fs = await import('fs');
const { getAnswer, settings } = await import('../utils.js');
const { default: createConversionList } =
  await import('../createConversionList.js');

const getAnswerMock = getAnswer as unknown as jest.Mock<
  (prompt?: unknown) => Promise<string>
>;

const answer = (self: string, conflicts: string[]) => {
  const queue = [...conflicts];
  getAnswerMock.mockImplementation(async (prompt) => {
    const text = String(prompt);
    if (/same file type/i.test(text)) return self;
    if (/\[O\]verwrite/i.test(text)) return queue.shift() ?? 's';
    return 'yes';
  });
};

const logged = (): string[] =>
  (console.log as jest.Mock).mock.calls.map((c) => c.join(' '));

describe('createConversionList input protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    settings.oggCodec = 'vorbis';
    settings.singleFileMode = false;
    settings.inputFilePath = '/music';
    settings.outputFilePath = '/music';
    settings.outputFormats = ['mp3'];
    fs.existsSync.mockReturnValue(false);
    mockExistingFilesInDir(fs.readdirSync, fs.statSync, '/music', [
      'song.wav',
      'song.mp3',
    ]);
  });

  for (const choice of ['o', 'oa']) {
    it(`renames instead of overwriting a queued input after "${choice}"`, async () => {
      answer('no', [choice]);

      const result = await createConversionList([
        join('/music', 'song.wav'),
        join('/music', 'song.mp3'),
      ]);

      expect(result).toEqual([
        {
          inputFile: join('/music', 'song.wav'),
          outputFile: join('/music', 'song-copy(1).mp3'),
          outputFormat: 'mp3',
        },
      ]);
    });
  }

  it('accepts "YES" at the same-type prompt without an invalid-input warning', async () => {
    answer('YES', []);
    mockExistingFilesInDir(fs.readdirSync, fs.statSync, '/music', ['song.mp3']);

    const result = await createConversionList([join('/music', 'song.mp3')]);

    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid input')
    );
    expect(result[0]?.outputFile).toBe(join('/music', 'song-copy(1).mp3'));
  });

  it('only announces an overwrite under "oa" for outputs that exist', async () => {
    settings.inputFilePath = '/in';
    settings.outputFilePath = '/out';
    mockExistingFilesInDir(fs.readdirSync, fs.statSync, '/out', ['a.mp3']);
    answer('no', ['oa']);

    await createConversionList([join('/in', 'a.wav'), join('/in', 'b.wav')]);

    const overwriteLines = logged().filter((l) => l.includes('OVERWRITE'));
    expect(overwriteLines.some((l) => l.includes('b.mp3'))).toBe(false);
  });
});
