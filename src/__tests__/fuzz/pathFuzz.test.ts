import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { join, resolve } from 'path';
import {
  buildOutputPath,
  getRelativeOutputDir,
} from '../../createConversionList.js';

const seededSegments = (): string[][] => [
  ['music'],
  ['My Music', 'track 01'],
  ['..', 'escape-attempt'],
  ['nested', 'deep', 'folder'],
  ['ゲーム', 'テスト'],
  ['Album (2024)', 'song'],
  ['.', 'dot-folder'],
  ['path with spaces', 'file#1'],
  ['100%', 'encoded'],
];

describe('path fuzz (deterministic seeds + property checks)', () => {
  it('buildOutputPath never places output outside the configured output root', () => {
    const outputRoot = resolve('/output/root');

    for (const parts of seededSegments()) {
      const inputRoot = resolve('/input/root', ...parts.slice(0, -1));
      const inputFile = resolve('/input/root', ...parts, 'song.wav');
      const built = buildOutputPath(inputFile, inputRoot, outputRoot, 'mp3');
      const rel = getRelativeOutputDir(inputRoot, inputFile);
      const expectedPrefix = rel ? join(outputRoot, rel) : outputRoot;

      expect(built.startsWith(expectedPrefix)).toBe(true);
      expect(built.includes('..')).toBe(false);
    }
  });

  it('getRelativeOutputDir returns empty string for paths outside input root', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,12}$/), (segment) => {
        const rel = getRelativeOutputDir(
          '/input',
          `/outside/${segment}/song.wav`
        );
        expect(rel).toBe('');
      }),
      { numRuns: 30 }
    );
  });
});
