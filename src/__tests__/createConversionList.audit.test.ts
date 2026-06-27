import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'path';

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
const { getAnswer, settings } = await import('../utils.js');
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
    getAnswerMock.mockResolvedValue('yes');
  });

  it('drops colliding outputs without any duplicate-specific warning', async () => {
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
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('duplicate output')
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Skipping duplicate')
    );
  });
});
