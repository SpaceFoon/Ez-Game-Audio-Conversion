import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { escapeCsvField } from '../../utils.js';
import {
  buildOutputPath,
  getRelativeOutputDir,
} from '../../createConversionList.js';
import { parseFormats } from '../../getUserInput.js';
import { resolve, join } from 'path';

const ALLOWED = ['ogg', 'mp3', 'm4a', 'wav', 'aiff', 'flac'] as const;

const safeSegment = fc
  .string({ minLength: 1, maxLength: 12 })
  .filter(
    (s) =>
      !s.includes('/') &&
      !s.includes('\\') &&
      !s.includes('..') &&
      s.trim() !== '.' &&
      s.trim() !== '..'
  );

describe('property: path and CSV edge cases', () => {
  it('escapeCsvField never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(() => escapeCsvField(value)).not.toThrow();
        expect(typeof escapeCsvField(value)).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('formula-prefix fields are neutralized for spreadsheet safety', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('=', '+', '-', '@', '\t'),
        fc.string({ minLength: 0, maxLength: 20 }),
        (prefix, rest) => {
          const field = `${prefix}${rest}`;
          const escaped = escapeCsvField(field);
          expect(escaped.startsWith("'") || escaped.startsWith('"')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('buildOutputPath stays under output root for safe path segments', () => {
    fc.assert(
      fc.property(
        fc.array(safeSegment, { minLength: 0, maxLength: 4 }),
        (parts) => {
          const outputRoot = resolve('/output/root');
          const inputRoot = resolve('/input/root');
          const inputFile = resolve(inputRoot, ...parts, 'track.wav');
          const rel = getRelativeOutputDir(inputRoot, inputFile);
          const built = buildOutputPath(
            inputFile,
            inputRoot,
            outputRoot,
            'mp3'
          );
          const expectedPrefix = rel ? join(outputRoot, rel) : outputRoot;
          expect(built.startsWith(expectedPrefix)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseFormats never throws and only returns allowed tokens', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(() => parseFormats(raw, [...ALLOWED])).not.toThrow();
        const parsed = parseFormats(raw, [...ALLOWED]);
        expect(parsed.every((fmt) => ALLOWED.includes(fmt))).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
