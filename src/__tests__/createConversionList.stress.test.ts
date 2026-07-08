/**
 * Large-batch createConversionList scenarios — run in CI unit suite but
 * excluded from Stryker (see stryker.conf.pure.json) to avoid OOM during mutation.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'path';
import { mockDefaultCreateConversionListAnswers } from './test-utils/createConversionListAnswers.js';
import { createConversionListFsMock } from './test-utils/mockCreateConversionListFs.js';

jest.unstable_mockModule('fs', () => createConversionListFsMock());

jest.unstable_mockModule('chalk', () => {
  const passthrough = jest.fn((...args: string[]) => args.join(' '));
  return {
    default: {
      blue: { bold: passthrough },
      blueBright: passthrough,
      green: Object.assign(passthrough, {
        italic: passthrough,
        bold: passthrough,
      }),
      cyanBright: passthrough,
      cyan: passthrough,
      redBright: Object.assign(passthrough, { bold: passthrough }),
      red: Object.assign(passthrough, { bold: passthrough }),
      yellow: passthrough,
      gray: passthrough,
    },
  };
});

jest.unstable_mockModule('../logger.js', () => ({
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

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
const { default: logger } = await import('../logger.js');
const { default: createConversionList } =
  await import('../createConversionList.js');

const getAnswerMock = getAnswer as unknown as jest.MockedFunction<
  typeof getAnswer
>;

describe('createConversionList stress scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settings.inputFilePath = '/input';
    settings.outputFilePath = '/output';
    settings.outputFormats = ['mp3'];
    settings.oggCodec = 'vorbis';
    settings.singleFileMode = false;
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    mockDefaultCreateConversionListAnswers(getAnswerMock);
  });

  it('writes progress output for large batches', async () => {
    const writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const files = Array.from({ length: 101 }, (_, index) =>
      join(settings.inputFilePath, `track-${index}.wav`)
    );

    const result = await createConversionList(files);

    expect(result).toHaveLength(101);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('Building list: 101/101 items... Done!')
    );
    writeSpy.mockRestore();
  });

  it('emits mid-batch progress every 1000 planned outputs', async () => {
    const writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    settings.outputFormats = [
      'mp3',
      'ogg',
      'flac',
      'wav',
      'aiff',
      'm4a',
      'mp3',
      'ogg',
      'flac',
      'wav',
    ];

    const files = Array.from({ length: 101 }, (_, index) =>
      join(settings.inputFilePath, `track-${index}.wav`)
    );

    await createConversionList(files);

    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('Building list: 1000/1010 items...')
    );
    writeSpy.mockRestore();
  });

  it('shows truncated preview when more than 200 outputs are pending', async () => {
    const files = Array.from({ length: 201 }, (_, index) =>
      join(settings.inputFilePath, `track-${index}.wav`)
    );

    await createConversionList(files);

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('... and 181 more files')
    );
  });

  it('does not stat every planned output when the output tree is empty', async () => {
    const files = Array.from({ length: 101 }, (_, index) =>
      join(settings.inputFilePath, `track-${index}.wav`)
    );

    await createConversionList(files);

    const outputFileStats = (fs.existsSync as jest.Mock).mock.calls.filter(
      ([path]) => String(path).endsWith('.mp3')
    );
    expect(outputFileStats).toHaveLength(0);
  });
});
