/**
 * Conflict/path handling against a REAL temp file system (symlinks, loops,
 * case collisions). Only prompts are scripted.
 */
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

jest.unstable_mockModule('../utils.js', () => ({
  getAnswer: jest.fn(),
  settings: {},
  handleExit: jest.fn((code: number) => {
    throw new Error(`EXIT_PROGRAM:${code}`);
  }),
  getErrorMessage: (e: unknown) => String(e),
  reportSearchErrors: jest.fn(async () => {}),
  recordSearchError: jest.fn(),
  clearSearchErrors: jest.fn(),
}));

const { getAnswer, settings } = await import('../utils.js');
const {
  default: createConversionList,
  scanExistingFiles,
  getRelativeOutputDir,
} = await import('../createConversionList.js');
const { default: searchFiles } = await import('../searchFiles.js');

const getAnswerMock = getAnswer as unknown as jest.Mock<
  (prompt?: unknown) => Promise<string>
>;

/** Script answers: conflict prompts consume `conflicts`; everything else is yes/no. */
const answer = (conflicts: string[] = [], sameType = 'no') => {
  const queue = [...conflicts];
  getAnswerMock.mockImplementation(async (prompt) => {
    const text = String(prompt);
    if (text.includes('[O]verwrite')) return queue.shift() ?? 's';
    if (text.includes('same file type')) return sameType;
    if (text.includes('Vorbis or Opus')) return ''; // default: vorbis
    return 'yes';
  });
};

let root: string;
const touch = (...parts: string[]) => {
  const p = join(root, ...parts);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, 'x');
  return p;
};

const configure = (
  input: string,
  output: string,
  inputFormats: string[],
  outputFormats: string[]
) =>
  Object.assign(settings, {
    inputFilePath: input,
    outputFilePath: output,
    inputFormats,
    outputFormats,
    oggCodec: 'vorbis',
    singleFileMode: false,
    singleFilePath: '',
  });

describe('createConversionList on a real file system', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    root = mkdtempSync(join(tmpdir(), 'ezga-ccl-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('never targets an input file through a symlinked output folder, even after "o"', async () => {
    const input = touch('in', 'a.ogg');
    symlinkSync(join(root, 'in'), join(root, 'inlink'));
    configure(join(root, 'in'), join(root, 'inlink'), ['ogg'], ['ogg']);
    answer(['o'], 'yes');

    const list = await createConversionList([input]);

    expect(list).toHaveLength(1);
    expect(list[0]!.outputFile).not.toBe(join(root, 'inlink', 'a.ogg'));
    expect(list[0]!.outputFile).toMatch(/a-copy\(1\)\.ogg$/);
  });

  it('scanExistingFiles terminates on symlink loops', () => {
    touch('loop', 'a.wav');
    symlinkSync('.', join(root, 'loop', 'l1'));
    symlinkSync('.', join(root, 'loop', 'l2'));

    const found = scanExistingFiles(join(root, 'loop'));

    expect([...found].some((p) => p.endsWith('a.wav'))).toBe(true);
  });

  it('treats outputs differing only by case as duplicates', async () => {
    const a = touch('in', 'A.wav');
    const b = touch('in', 'a.flac');
    configure(join(root, 'in'), join(root, 'out'), ['wav', 'flac'], ['mp3']);
    answer();

    const list = await createConversionList([a, b]);

    expect(list).toHaveLength(1);
  });

  it('"ra" renames a second input that maps to an already planned output', async () => {
    const a = touch('in', 'a.wav');
    const b = touch('in', 'a.flac');
    touch('out', 'other.mp3'); // non-empty output so conflict checks run
    touch('out', 'z.mp3');
    const z = touch('in', 'z.wav');
    configure(join(root, 'in'), join(root, 'out'), ['wav', 'flac'], ['mp3']);
    answer(['ra']);

    // z.wav first triggers the conflict prompt and sets "ra" for the rest.
    const list = await createConversionList([z, a, b]);

    const outputs = list.map((x) => x.outputFile);
    expect(outputs).toHaveLength(3);
    expect(new Set(outputs).size).toBe(3);
  });

  it('keeps folder structure for folders whose name starts with ".."', () => {
    expect(getRelativeOutputDir('/music/in', '/music/in/..odd/x.wav')).toBe(
      '..odd'
    );
  });
});

describe('searchFiles extension matching', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ezga-search-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('finds .aif files for AIFF and skips macOS "._" stubs', async () => {
    touch('b.aif');
    touch('c.aiff');
    touch('._c.wav');
    touch('d.wav');
    const found = await searchFiles({
      inputFilePath: root,
      outputFilePath: join(root, 'out'),
      inputFormats: ['aiff', 'wav'],
      outputFormats: ['mp3'],
      oggCodec: null,
      singleFileMode: false,
      singleFilePath: '',
    } as never);

    const names = found.map((p) => p.slice(root.length + 1)).sort();
    expect(names).toEqual(['b.aif', 'c.aiff', 'd.wav']);
  });
});
