import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import {
  formatMetaDataArgs,
  sanitizeMetaValueForArgs,
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

const adversarialString = fc.oneof(
  fc.string({ minLength: 0, maxLength: 500 }),
  fc.constantFrom(
    'hello\r\nworld',
    'injected\n-arg',
    '\u0000hidden',
    '\uFFFDreplacement',
    '=CMD|calc',
    '@SUM(A1)',
    'a\u200Db', // ZWJ
    'مرحبا',
    '🎵🎶'
  )
);

describe('metadata fuzz (adversarial inputs)', () => {
  it('sanitizeMetaValueForArgs never throws and strips dangerous characters', () => {
    fc.assert(
      fc.property(adversarialString, (raw) => {
        const cleaned = sanitizeMetaValueForArgs(raw);
        expect(cleaned).not.toContain('\u0000');
        expect(cleaned).not.toContain('\uFFFD');
        expect(cleaned).not.toMatch(/\r/);
      }),
      { numRuns: 200 }
    );
  });

  it('formatMetaDataArgs never throws and argv has no raw newline injection', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,20}$/),
        adversarialString,
        (key, value) => {
          const { metaDataArgs } = formatMetaDataArgs({
            format: {
              tags: { [key]: value },
            },
            streams: [{ tags: {} }],
          });
          for (const arg of metaDataArgs) {
            expect(arg).not.toMatch(/\n|\r/);
          }
        }
      ),
      { numRuns: 150 }
    );
  });
});
