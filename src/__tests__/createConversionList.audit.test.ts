import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'path';
import { mockDefaultCreateConversionListAnswers } from './test-utils/createConversionListAnswers.js';
import {
  createConversionListFsMock,
  mockExistingFilesInDir,
} from './test-utils/mockCreateConversionListFs.js';

jest.unstable_mockModule('fs', () => createConversionListFsMock());

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

  return {
    default: {
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
    },
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
const readdirSyncMock = fs.readdirSync as unknown as jest.MockedFunction<
  typeof fs.readdirSync
>;
const statSyncMock = fs.statSync as unknown as jest.MockedFunction<
  typeof fs.statSync
>;
const getAnswerMock = getAnswer as unknown as jest.MockedFunction<
  typeof getAnswer
>;
const handleExitMock = handleExit as unknown as jest.MockedFunction<
  typeof handleExit
>;
const reportSearchErrorsMock =
  reportSearchErrors as unknown as jest.MockedFunction<
    typeof reportSearchErrors
  >;

describe('createConversionList audit characterizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settings.inputFilePath = '/input-root';
    settings.outputFilePath = '/output-root';
    settings.outputFormats = ['mp3'];
    settings.oggCodec = 'vorbis';
    settings.singleFileMode = false;
    existsSyncMock.mockReturnValue(false);
    mkdirSyncMock.mockImplementation(() => undefined);
    readdirSyncMock.mockReturnValue([]);
    statSyncMock.mockReturnValue({ isDirectory: () => false } as never);
    mockDefaultCreateConversionListAnswers(getAnswerMock);
  });

  it('warns when dropping colliding outputs instead of silently discarding them', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const firstInput = '/outside-a/song.wav';
    const secondInput = '/outside-b/song.wav';

    const result = await createConversionList([firstInput, secondInput]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        inputFile: firstInput,
        outputFile: join('/output-root', 'song.mp3'),
      })
    );
    expect(
      result.find((item) => item.inputFile === secondInput)
    ).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/duplicate output|Skipping duplicate/i)
    );

    warnSpy.mockRestore();
  });

  it('warns when two inputs share a basename across folders and collide on mp3', async () => {
    settings.outputFormats = ['mp3', 'ogg'];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const firstInput = '/folder-a/track.wav';
    const secondInput = '/folder-b/track.wav';

    const result = await createConversionList([firstInput, secondInput]);

    expect(
      result.filter((item) => item.outputFile.endsWith('.mp3'))
    ).toHaveLength(1);
    expect(
      result.filter((item) => item.outputFile.endsWith('.ogg'))
    ).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/duplicate output|Skipping duplicate/i)
    );

    warnSpy.mockRestore();
  });

  it('reports search errors and exits before finalize when the input list is empty', async () => {
    await createConversionList([]);

    expect(reportSearchErrorsMock).toHaveBeenCalledTimes(1);
    expect(handleExitMock).toHaveBeenCalledWith(1);
  });

  it('AUDIT: drops second input when rename mode still collides on basename', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // First input: rename around the existing song.mp3. Second input collides
    // again, so the user skips it. (A bare 'yes' is not a valid overwrite
    // answer, so the prompt would re-ask — the mock must give a real choice.)
    getAnswerMock
      .mockResolvedValueOnce('r')
      .mockResolvedValueOnce('s')
      .mockResolvedValueOnce('yes');

    mockExistingFilesInDir(
      readdirSyncMock,
      statSyncMock,
      settings.outputFilePath,
      ['song.mp3', 'song-copy(1).mp3']
    );
    existsSyncMock.mockImplementation((targetPath) => {
      const pathStr = String(targetPath);
      if (pathStr.endsWith('song.mp3')) return true;
      if (pathStr.includes('-copy(1).mp3')) return true;
      return false;
    });

    const firstInput = '/outside-a/song.wav';
    const secondInput = '/outside-b/song.wav';

    const result = await createConversionList([firstInput, secondInput]);

    expect(result.length).toBeLessThanOrEqual(1);
    expect(
      result.filter((item) => item.outputFile.endsWith('song.mp3')).length
    ).toBeLessThanOrEqual(1);

    warnSpy.mockRestore();
  });
});
