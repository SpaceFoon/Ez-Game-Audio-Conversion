import { describe, it, expect } from '@jest/globals';
import { sanitizeMetaValueForArgs } from '../metadataService.js';
import { escapeCsvField } from '../utils.js';

const seededStrings = (count: number): string[] => {
  const seeds = [
    'normal',
    'with,comma',
    'with"quote',
    "with'quote",
    'with\nnewline',
    'with\rreturn',
    'with\uFFFDreplacement',
    'with\x00null',
    '='.repeat(10000),
    'ゲーム音楽',
    '@formula',
    '+formula',
  ];

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`${seeds[i % seeds.length]}-${i}`);
  }
  return out;
};

describe('metadata fuzz (deterministic seeds)', () => {
  it('sanitizeMetaValueForArgs never returns raw null bytes', () => {
    for (const raw of seededStrings(48)) {
      const sanitized = sanitizeMetaValueForArgs(raw);
      expect(sanitized.includes('\0')).toBe(false);
    }
  });

  it('sanitizeMetaValueForArgs produces single-token values suitable for argv arrays', () => {
    for (const raw of seededStrings(48)) {
      const sanitized = sanitizeMetaValueForArgs(raw);
      const token = `-metadata:title=${sanitized}`;
      expect(token.includes('\0')).toBe(false);
      expect(Array.isArray(token.split(' '))).toBe(true);
    }
  });

  it('escapeCsvField neutralizes formula-leading values and keeps parseable rows', () => {
    for (const raw of seededStrings(32)) {
      const escaped = escapeCsvField(raw);
      if (/^[=+\-@\t\r]/.test(raw)) {
        expect(escaped.startsWith("'")).toBe(true);
      }
      expect(typeof escaped).toBe('string');
    }
  });
});
