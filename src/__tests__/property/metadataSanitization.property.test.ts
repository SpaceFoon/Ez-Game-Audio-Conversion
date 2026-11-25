import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import {
  sanitizeMetaValueForArgs,
  formatMetaDataArgs,
} from '../../metadataService.js';

import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join as joinPath } from 'path';
import { __setLogFileStateForTests } from '../../utils.js';

// formatMetaDataArgs logs cleanup warnings to CSV; keep them out of the repo.
const logDir = mkdtempSync(joinPath(tmpdir(), 'ezga-meta-logs-'));
__setLogFileStateForTests(
  joinPath(logDir, 'logs.csv'),
  joinPath(logDir, 'error.csv')
);

const adversarialValue = fc.oneof(
  fc.string({ minLength: 0, maxLength: 300 }),
  fc.constantFrom(
    'hello\r\nworld',
    'injected\n-arg',
    '\u0000hidden',
    '\uFFFDreplacement',
    '=CMD|calc',
    '@SUM(A1)',
    '+1+1',
    '-2+3',
    '\tformula'
  )
);

describe('property: metadata sanitization', () => {
  it('sanitizeMetaValueForArgs never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(adversarialValue, (raw) => {
        expect(() => sanitizeMetaValueForArgs(raw)).not.toThrow();
        const cleaned = sanitizeMetaValueForArgs(raw);
        expect(typeof cleaned).toBe('string');
        expect(cleaned).not.toContain('\u0000');
        expect(cleaned).not.toContain('\uFFFD');
        expect(cleaned).not.toMatch(/\r/);
      }),
      { numRuns: 200 }
    );
  });

  it('formatMetaDataArgs never throws on adversarial metadata', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,20}$/),
        adversarialValue,
        (key, value) => {
          expect(() =>
            formatMetaDataArgs({
              format: { tags: { [key]: value } },
              streams: [{ tags: {} }],
            })
          ).not.toThrow();
        }
      ),
      { numRuns: 150 }
    );
  });

  it('keeps embedded line breaks as \\n (no carriage returns)', () => {
    const { metaDataArgs } = formatMetaDataArgs({
      format: { tags: { title: 'hello\r\nworld' } },
      streams: [{ tags: {} }],
    });

    expect(metaDataArgs).toContain('title=hello\nworld');
    expect(metaDataArgs.some((arg) => arg.includes('\r'))).toBe(false);
  });
});
