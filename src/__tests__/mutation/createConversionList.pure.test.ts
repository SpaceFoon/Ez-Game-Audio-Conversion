import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { join, resolve } from 'path';

jest.unstable_mockModule('../../logger.js', () => ({
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const logger = (await import('../../logger.js')).default;
const {
  parseCopyFilename,
  buildOutputPath,
  buildBasenameWithFormat,
  pathsResolveToSameFile,
  getRelativeOutputDir,
} = await import('../../createConversionList.js');

describe('createConversionList pure exports (mutation hardening)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCopyFilename', () => {
    it('returns num 0 when no -copy(n) suffix is present', () => {
      expect(parseCopyFilename('/music/song.mp3')).toEqual({
        base: 'song',
        num: 0,
      });
    });

    it('parses nested path copy suffix', () => {
      expect(parseCopyFilename('/out/album/track-copy(7).flac')).toEqual({
        base: 'track',
        num: 7,
      });
    });

    it('does not treat partial copy patterns as rename suffix', () => {
      expect(parseCopyFilename('song-copy.mp3')).toEqual({
        base: 'song-copy',
        num: 0,
      });
    });

    it('requires the copy suffix to end the basename', () => {
      expect(parseCopyFilename('song-copy(1)-extra.mp3')).toEqual({
        base: 'song-copy(1)-extra',
        num: 0,
      });
    });

    it('does not match when extra characters trail the copy suffix', () => {
      expect(parseCopyFilename('song-copy(1)x.mp3')).toEqual({
        base: 'song-copy(1)x',
        num: 0,
      });
    });
  });

  describe('buildBasenameWithFormat', () => {
    it('replaces extension with target format', () => {
      expect(buildBasenameWithFormat('/in/deep/song.wav', 'ogg')).toBe(
        'song.ogg'
      );
    });
  });

  describe('buildOutputPath', () => {
    it('preserves nested folder structure under output root', () => {
      const inputRoot = resolve('/input/root');
      const outputRoot = resolve('/output/root');
      const inputFile = join(inputRoot, 'pack', 'sfx', 'hit.wav');

      expect(buildOutputPath(inputFile, inputRoot, outputRoot, 'mp3')).toBe(
        join(outputRoot, 'pack', 'sfx', 'hit.mp3')
      );
    });

    it('places root-level files directly under output root', () => {
      const inputRoot = resolve('/input');
      const outputRoot = resolve('/output');
      const inputFile = join(inputRoot, 'song.wav');

      expect(buildOutputPath(inputFile, inputRoot, outputRoot, 'flac')).toBe(
        join(outputRoot, 'song.flac')
      );
    });
  });

  describe('pathsResolveToSameFile', () => {
    it('returns true for case-only differences on the same path', () => {
      expect(pathsResolveToSameFile('/tmp/Song.WAV', '/tmp/song.wav')).toBe(
        true
      );
    });

    it('returns false for different files', () => {
      expect(pathsResolveToSameFile('/tmp/a.wav', '/tmp/b.wav')).toBe(false);
    });
  });

  describe('getRelativeOutputDir', () => {
    it('returns empty string for files at input root', () => {
      const root = resolve('/input');
      expect(getRelativeOutputDir(root, join(root, 'song.wav'))).toBe('');
    });

    it('returns relative subdirectory for nested inputs', () => {
      const root = resolve('/input');
      expect(getRelativeOutputDir(root, join(root, 'pack', 'song.wav'))).toBe(
        join('pack')
      );
    });

    it('warns and falls back when input escapes the declared root', () => {
      const root = resolve('/input');
      const outside = resolve('/elsewhere/song.wav');

      expect(getRelativeOutputDir(root, outside)).toBe('');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not preserve folder structure')
      );
    });
  });
});
