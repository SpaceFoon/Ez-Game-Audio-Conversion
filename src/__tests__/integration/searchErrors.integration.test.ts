import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from '@jest/globals';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const outputDir = mkdtempSync(join(tmpdir(), 'search-errors-int-'));

jest.unstable_mockModule('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    realpathSync: jest.fn((p: string) => p),
  };
});

jest.unstable_mockModule('chalk', () => {
  const makeFn = () => jest.fn((...args: string[]) => args.join(' '));
  const makeBold = () =>
    Object.assign(makeFn(), { bold: makeFn() }) as ReturnType<typeof makeFn> & {
      bold: ReturnType<typeof makeFn>;
    };
  const colors = {
    whiteBright: { bold: makeFn() },
    white: makeFn(),
    gray: makeFn(),
    blue: makeFn(),
    blueBright: makeFn(),
    cyan: makeFn(),
    cyanBright: makeFn(),
    green: makeFn(),
    red: makeBold(),
    redBright: makeBold(),
    yellowBright: makeFn(),
    yellow: makeFn(),
  };
  const defaultExport = Object.assign(makeFn(), colors);
  return { default: defaultExport, ...colors };
});

const fs = await import('fs');
const { default: searchFiles } = await import('../../searchFiles.js');
const { default: finalize } = await import('../../finalize.js');
const { settings, initializeFileNames, rl, clearSearchErrors } =
  await import('../../utils.js');

const readdirSyncMock = fs.readdirSync as unknown as jest.MockedFunction<
  typeof fs.readdirSync
>;
const statSyncMock = fs.statSync as unknown as jest.MockedFunction<
  typeof fs.statSync
>;

describe('search errors end-to-end integration', () => {
  let questionSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    clearSearchErrors();
    settings.outputFilePath = outputDir;
    initializeFileNames();
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    questionSpy = jest
      .spyOn(rl, 'question')
      .mockImplementation((_msg, cb) => cb('q'));
  });

  afterEach(() => {
    questionSpy.mockRestore();
  });

  afterAll(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it('flows from searchFiles through finalize into error.csv', async () => {
    readdirSyncMock.mockReturnValueOnce(['good.mp3', 'locked.wav'] as never);
    statSyncMock.mockImplementation((targetPath) => {
      if (String(targetPath).endsWith('locked.wav')) {
        throw new Error('EACCES: permission denied');
      }
      return { isDirectory: () => false } as ReturnType<typeof fs.statSync>;
    });

    const files = await searchFiles({
      inputFilePath: '/project/audio',
      inputFormats: ['mp3', 'wav'],
    } as never);

    expect(files).toEqual([join('/project/audio', 'good.mp3')]);

    await finalize([], [], Date.now());

    const errorCsv = readdirSync(outputDir).find((name) =>
      name.startsWith('error')
    );
    expect(errorCsv).toBeDefined();

    const content = readFileSync(join(outputDir, errorCsv!), 'utf8');
    expect(content).toContain('locked.wav');
    expect(content).toContain('Unreadable path skipped during search');
    expect(existsSync(join(outputDir, errorCsv!))).toBe(true);
  });

  it('reports search errors and exits when search yields zero files', async () => {
    readdirSyncMock.mockReturnValueOnce(['broken.mp3'] as never);
    statSyncMock.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const files = await searchFiles({
      inputFilePath: '/project/empty-audio',
      inputFormats: ['mp3'],
    } as never);

    expect(files).toEqual([]);

    const { default: createConversionList } =
      await import('../../createConversionList.js');
    const { default: ExitProgramError } =
      await import('../../exitProgramError.js');

    settings.inputFilePath = '/project/empty-audio';
    settings.outputFilePath = outputDir;
    settings.outputFormats = ['mp3'];

    await expect(createConversionList(files)).rejects.toThrow(ExitProgramError);

    const errorCsv = readdirSync(outputDir).find((name) =>
      name.startsWith('error')
    );
    expect(errorCsv).toBeDefined();
    const content = readFileSync(join(outputDir, errorCsv!), 'utf8');
    expect(content).toContain('broken.mp3');
  });
});
