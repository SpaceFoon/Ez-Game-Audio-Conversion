import { describe, it, expect } from '@jest/globals';
import { join, resolve } from 'path';
import {
  buildOutputPath,
  getRelativeOutputDir,
} from '../createConversionList.js';

const seededSegments = (): string[][] => {
  const segments = [
    ['music'],
    ['My Music', 'track 01'],
    ['..', 'escape-attempt'],
    ['nested', 'deep', 'folder'],
    ['ゲーム', 'テスト'],
    ['Album (2024)', 'song'],
    ['.', 'dot-folder'],
  ];
  return segments;
};

describe('path fuzz (deterministic seeds)', () => {
  it('buildOutputPath never places output outside the configured output root', () => {
    const outputRoot = resolve('/output/root');

    for (const parts of seededSegments()) {
      const inputRoot = resolve('/input/root', ...parts.slice(0, -1));
      const inputFile = resolve('/input/root', ...parts, 'song.wav');
      const rel = getRelativeOutputDir(inputRoot, inputFile);
      const built = buildOutputPath(inputFile, inputRoot, outputRoot, 'mp3');
      const expectedPrefix = rel ? join(outputRoot, rel) : outputRoot;

      expect(built.startsWith(expectedPrefix)).toBe(true);
      expect(built.includes('..')).toBe(false);
    }
  });

  it('getRelativeOutputDir returns empty string for escape attempts', () => {
    const rel = getRelativeOutputDir('/input', '/outside/other/song.wav');
    expect(rel).toBe('');
  });
});
