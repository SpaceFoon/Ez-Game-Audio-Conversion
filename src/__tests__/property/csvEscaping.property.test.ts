import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { escapeCsvField } from '../../utils.js';

const formulaStart = /^[=+\-@]/;

describe('escapeCsvField property tests', () => {
  it('never leaves formula-injection prefixes unquoted', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (value) => {
        const escaped = escapeCsvField(value);
        if (formulaStart.test(value)) {
          expect(escaped.startsWith("'") || escaped.startsWith('"')).toBe(true);
        }
      }),
      { numRuns: 80 }
    );
  });

  it('prefixes values that start with formula characters', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('=', '+', '-', '@'),
        fc.stringMatching(/^[a-z0-9]{0,20}$/),
        (prefix, rest) => {
          const escaped = escapeCsvField(`${prefix}${rest}`);
          expect(escaped.startsWith("'")).toBe(true);
        }
      ),
      { numRuns: 40 }
    );
  });

  it('wraps values containing commas, quotes, or newlines', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.constantFrom(',', '"', '\n', '\r'),
        fc.string({ minLength: 0, maxLength: 100 }),
        (prefix, sep, suffix) => {
          const value = `${prefix}${sep}${suffix}`;
          const escaped = escapeCsvField(value);
          if (
            value.includes(',') ||
            value.includes('"') ||
            /[\r\n]/.test(value)
          ) {
            expect(escaped.startsWith('"')).toBe(true);
            expect(escaped.endsWith('"')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('preserves safe alphanumeric content without formula-prefix wrapping', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9_][A-Za-z0-9_ ]{0,79}$/),
        (value) => {
          const escaped = escapeCsvField(value);
          expect(escaped).toBe(value);
        }
      ),
      { numRuns: 80 }
    );
  });
});
