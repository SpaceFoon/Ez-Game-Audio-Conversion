import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'path';

// These tests originally characterized BROKEN behavior (one unreadable entry or
// a symlink loop crashing the whole search). The walk is now resilient, so they
// assert the fixed behavior: skip-and-continue plus loop protection.

jest.unstable_mockModule('fs', () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  realpathSync: jest.fn((p: string) => p),
  // Present so utils.js (imported transitively) can link its fs named imports.
  openSync: jest.fn(),
  closeSync: jest.fn(),
  existsSync: jest.fn(),
  appendFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => ({
  default: {
    whiteBright: { bold: jest.fn((...args) => args.join(' ')) },
    white: jest.fn((...args) => args.join(' ')),
    gray: jest.fn((...args) => args.join(' ')),
  },
  whiteBright: { bold: jest.fn((...args) => args.join(' ')) },
  white: jest.fn((...args) => args.join(' ')),
  gray: jest.fn((...args) => args.join(' ')),
}));

const fs = await import('fs');
const { default: searchFiles, MAX_WALK_DEPTH } =
  await import('../searchFiles.js');
const { getSearchErrors, clearSearchErrors } = await import('../utils.js');

const readdirSyncMock = fs.readdirSync as unknown as jest.MockedFunction<
  typeof fs.readdirSync
>;
const statSyncMock = fs.statSync as unknown as jest.MockedFunction<
  typeof fs.statSync
>;
const realpathSyncMock = fs.realpathSync as unknown as jest.MockedFunction<
  typeof fs.realpathSync
>;

describe('searchFiles resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSearchErrors();
    realpathSyncMock.mockImplementation((p) => p as string);
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  it('skips an unreadable entry, keeps going, and records the error', async () => {
    readdirSyncMock.mockReturnValueOnce(['good.mp3', 'broken.wav'] as never);
    statSyncMock.mockImplementation((targetPath) => {
      if (String(targetPath).endsWith('broken.wav')) {
        throw new Error('EACCES: permission denied');
      }
      return { isDirectory: () => false } as ReturnType<typeof fs.statSync>;
    });

    const result = await searchFiles({
      inputFilePath: '/audit/input',
      inputFormats: ['mp3', 'wav'],
    } as never);

    expect(result).toEqual([join('/audit/input', 'good.mp3')]);

    const errors = getSearchErrors();
    expect(
      errors.some(
        (e) => e.path.endsWith('broken.wav') && /EACCES/.test(e.message)
      )
    ).toBe(true);
  });

  it('does not recurse forever when a directory loops back on itself', async () => {
    readdirSyncMock.mockReturnValue(['loop'] as never);
    statSyncMock.mockReturnValue({
      isDirectory: () => true,
    } as ReturnType<typeof fs.statSync>);
    // Simulate a symlink/junction loop: every path resolves to the same dir.
    realpathSyncMock.mockReturnValue('/audit/root' as never);

    const result = await searchFiles({
      inputFilePath: '/audit/root',
      inputFormats: ['wav'],
    } as never);

    expect(result).toEqual([]);
    // The loop is detected after the first directory read, so we never spin.
    expect(readdirSyncMock).toHaveBeenCalledTimes(1);
  });

  it(`stops descending past MAX_WALK_DEPTH (${MAX_WALK_DEPTH}) and records an error`, async () => {
    readdirSyncMock.mockReturnValue(['child'] as never);
    statSyncMock.mockReturnValue({
      isDirectory: () => true,
    } as ReturnType<typeof fs.statSync>);
    realpathSyncMock.mockImplementation((p) => String(p) as never);

    await searchFiles({
      inputFilePath: '/audit/deep',
      inputFormats: ['wav'],
    } as never);

    expect(readdirSyncMock.mock.calls.length).toBeLessThanOrEqual(
      MAX_WALK_DEPTH + 2
    );
    expect(
      getSearchErrors().some((error) =>
        error.message.includes(String(MAX_WALK_DEPTH))
      )
    ).toBe(true);
  });
});
