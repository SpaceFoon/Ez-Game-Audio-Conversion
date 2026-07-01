import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { outputPathHasInvalidCharacters } from '../../converterWorker.js';

describe('property: path validation (outputPathHasInvalidCharacters)', () => {
  it('rejects paths containing double quotes', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (prefix, suffix) => {
        const path = `${prefix}"${suffix}`;
        expect(outputPathHasInvalidCharacters(path)).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  it('rejects paths containing newline or carriage return', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('\n', '\r'),
        fc.string({ maxLength: 30 }),
        fc.string({ maxLength: 30 }),
        (sep, a, b) => {
          expect(outputPathHasInvalidCharacters(`${a}${sep}${b}`)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('accepts typical Windows drive-letter paths without illegal chars', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('C', 'D', 'E'),
        fc.array(fc.stringMatching(/^[a-zA-Z0-9 _.-]{1,12}$/), {
          minLength: 1,
          maxLength: 4,
        }),
        (drive, segments) => {
          const path = `${drive}:\\${segments.join('\\')}\\song.mp3`;
          expect(outputPathHasInvalidCharacters(path)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects paths with shell-unsafe characters in the path body', () => {
    fc.assert(
      fc.property(fc.constantFrom('<', '>', ':', '|', '?', '*'), (badChar) => {
        expect(
          outputPathHasInvalidCharacters(`/music/bad${badChar}file.mp3`)
        ).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  it('warns on long paths but still validates character rules only', () => {
    const longPath = `C:\\Music\\${'a'.repeat(300)}\\song.mp3`;
    expect(outputPathHasInvalidCharacters(longPath)).toBe(false);
  });
});
