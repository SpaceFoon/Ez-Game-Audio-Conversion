/**
 * Loop-tag question (B21): the scan that decides whether to ask, and the
 * prompt in createConversionList. Real temp files; only prompts are scripted.
 */
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
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
}));

const { getAnswer, settings } = await import('../utils.js');
const { default: createConversionList, askLoopDataMode } =
  await import('../createConversionList.js');
const { fileHasLoopTags, findLoopTaggedFile } =
  await import('../loopTagScan.js');

const getAnswerMock = getAnswer as unknown as jest.Mock<
  (prompt?: unknown) => Promise<string>
>;

/** Minimal RIFF/WAVE file, optionally with a one-loop smpl chunk. */
const wav = (loop?: { start: number; end: number }): Buffer => {
  const fmt = Buffer.alloc(8 + 16);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8);
  fmt.writeUInt16LE(1, 10);
  fmt.writeUInt32LE(44100, 12);
  fmt.writeUInt32LE(88200, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const data = Buffer.alloc(8 + 4);
  data.write('data', 0, 'ascii');
  data.writeUInt32LE(4, 4);
  const chunks = [fmt, data];
  if (loop) {
    const smpl = Buffer.alloc(8 + 36 + 24);
    smpl.write('smpl', 0, 'ascii');
    smpl.writeUInt32LE(36 + 24, 4);
    smpl.writeUInt32LE(1, 8 + 28);
    smpl.writeUInt32LE(loop.start, 8 + 36 + 8);
    smpl.writeUInt32LE(loop.end, 8 + 36 + 12);
    chunks.push(smpl);
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + body.length, 4);
  header.write('WAVE', 8, 'ascii');
  return Buffer.concat([header, body]);
};

let root: string;
const file = (name: string, content: string | Buffer) => {
  const p = join(root, name);
  writeFileSync(p, content);
  return p;
};

beforeEach(() => {
  jest.clearAllMocks();
  root = mkdtempSync(join(tmpdir(), 'ezga-loopscan-'));
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('loop tag scan', () => {
  it('finds tags in the header, in any spelling', () => {
    expect(fileHasLoopTags(file('a.ogg', 'OggS...LOOPSTART=100'))).toBe(true);
    expect(fileHasLoopTags(file('b.flac', 'fLaC...loop_end=9'))).toBe(true);
    expect(fileHasLoopTags(file('c.mp3', 'ID3 TXXX LoopLength'))).toBe(true);
  });

  it('finds tags in the trailer of a large file', () => {
    const big = Buffer.alloc(1024 * 1024);
    big.write('LOOPSTART', big.length - 100, 'latin1');
    expect(fileHasLoopTags(file('big.m4a', big))).toBe(true);
  });

  it('finds a WAV smpl-chunk loop', () => {
    expect(fileHasLoopTags(file('loop.wav', wav({ start: 0, end: 99 })))).toBe(
      true
    );
    expect(fileHasLoopTags(file('plain.wav', wav()))).toBe(false);
  });

  it('returns false for untagged and missing files', () => {
    expect(fileHasLoopTags(file('x.ogg', 'OggS no tags here'))).toBe(false);
    expect(fileHasLoopTags(join(root, 'missing.ogg'))).toBe(false);
  });

  it('stops at the first tagged file and respects maxFiles', () => {
    const plain = file('p.ogg', 'nothing');
    const tagged = file('t.ogg', 'LOOPSTART=1');
    expect(findLoopTaggedFile([plain, tagged])).toBe(tagged);
    expect(findLoopTaggedFile([plain, tagged], { maxFiles: 1 })).toBeNull();
  });
});

describe('askLoopDataMode', () => {
  const answers = (...list: string[]) => {
    const queue = [...list];
    getAnswerMock.mockImplementation(async () => queue.shift() ?? '');
  };

  it.each([
    ['', 'auto'],
    ['keep', 'auto'],
    ['SKIP', 'skip'],
    ['force', 'force'],
    ['f', 'force'],
  ])('answer %j gives %s when force is offered', async (input, mode) => {
    answers(input);
    await expect(askLoopDataMode('/x/a.ogg', true)).resolves.toBe(mode);
  });

  it('asks again when force is typed but not offered', async () => {
    answers('force', 'skip');
    await expect(askLoopDataMode('/x/a.ogg', false)).resolves.toBe('skip');
    expect(getAnswerMock).toHaveBeenCalledTimes(2);
    expect(String(getAnswerMock.mock.calls[0]![0])).not.toContain('force');
  });

  it('only mentions force when WAV or M4A is an output', async () => {
    answers('');
    await askLoopDataMode('/x/a.ogg', true);
    expect(String(getAnswerMock.mock.calls[0]![0])).toContain('force');
  });
});

describe('createConversionList loop question', () => {
  const configure = (outputFormats: string[]) =>
    Object.assign(settings, {
      inputFilePath: root,
      outputFilePath: join(root, 'out'),
      inputFormats: ['ogg'],
      outputFormats,
      oggCodec: 'vorbis',
      singleFileMode: false,
      singleFilePath: '',
      loopDataMode: 'force',
    });

  const script = (loopAnswer: string) =>
    getAnswerMock.mockImplementation(async (prompt) => {
      if (String(prompt).includes('Loop tags:')) return loopAnswer;
      if (String(prompt).includes('Vorbis or Opus')) return '';
      return 'yes';
    });

  const loopPrompts = () =>
    getAnswerMock.mock.calls.filter((c) => String(c[0]).includes('Loop tags:'));

  it('does not ask, and resets to auto, when no input has loop tags', async () => {
    configure(['mp3']);
    script('skip');
    await createConversionList([file('a.ogg', 'no tags')]);
    expect(loopPrompts()).toHaveLength(0);
    expect((settings as { loopDataMode?: string }).loopDataMode).toBe('auto');
  });

  it('asks and stores the answer when an input has loop tags', async () => {
    configure(['mp3', 'wav']);
    script('skip');
    await createConversionList([file('a.ogg', 'LOOPSTART=5')]);
    expect(loopPrompts()).toHaveLength(1);
    expect(String(loopPrompts()[0]![0])).toContain('force');
    expect((settings as { loopDataMode?: string }).loopDataMode).toBe('skip');
  });
});
