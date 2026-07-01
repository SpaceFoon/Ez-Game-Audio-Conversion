import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { resolve, join } from 'path';
import {
  buildOutputPath,
  parseCopyFilename,
  pathsResolveToSameFile,
} from '../../createConversionList.js';

describe('path generation property tests', () => {
  it('buildOutputPath never embeds parent-directory segments', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,12}$/), {
          minLength: 0,
          maxLength: 4,
        }),
        fc.stringMatching(/^[a-zA-Z0-9_-]{1,16}$/),
        (folderParts, basenameStem) => {
          const inputRoot = resolve('/input/root');
          const outputRoot = resolve('/output/root');
          const inputFile = resolve(
            '/input/root',
            ...folderParts,
            `${basenameStem}.wav`
          );
          const built = buildOutputPath(
            inputFile,
            inputRoot,
            outputRoot,
            'mp3'
          );
          expect(built.includes('..')).toBe(false);
          expect(built.startsWith(outputRoot)).toBe(true);
        }
      ),
      { numRuns: 120 }
    );
  });

  it('parseCopyFilename increments copy numbers monotonically', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
        const filename = join('folder', `song-copy(${n}).mp3`);
        const parsed = parseCopyFilename(filename);
        expect(parsed.base).toBe('song');
        expect(parsed.num).toBe(n);
      }),
      { numRuns: 50 }
    );
  });

  it('pathsResolveToSameFile is reflexive for normalized paths', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9_-]{1,20}$/), (name) => {
        const p = resolve('/tmp', name, 'file.wav');
        expect(pathsResolveToSameFile(p, p)).toBe(true);
      }),
      { numRuns: 40 }
    );
  });
});
