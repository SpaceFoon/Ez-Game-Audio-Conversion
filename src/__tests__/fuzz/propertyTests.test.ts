import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { parseFormats } from '../../getUserInput.js';
import { escapeCsvField } from '../../utils.js';
import {
  sanitizeMetaValueForArgs,
  convertLoopPoints,
} from '../../metadataService.js';
import { parseCopyFilename } from '../../createConversionList.js';
import type { AudioFormat } from '../../types/audio.js';
import type { AudioMetadata } from '../../types/metadata.js';

const allowedFormats: AudioFormat[] = [
  'flac',
  'aiff',
  'wav',
  'mp3',
  'm4a',
  'ogg',
];

const makeLoopMetadata = (
  sampleRate: number,
  loopStart: number,
  loopLength: number
): AudioMetadata => ({
  streams: [
    {
      index: 0,
      codec_name: 'pcm_s16le',
      codec_type: 'audio',
      sample_rate: String(sampleRate),
      channels: 2,
      tags: {},
    },
  ],
  format: {
    filename: 'test.wav',
    format_name: 'wav',
    duration: '1',
    size: '1',
    bit_rate: '1',
    tags: {
      LOOPSTART: String(loopStart),
      LOOPLENGTH: String(loopLength),
    },
  },
});

describe('property-based fuzz tests', () => {
  it('parseFormats never throws and only returns allowed formats', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseFormats(input, allowedFormats);
        expect(Array.isArray(result)).toBe(true);
        expect(result.every((fmt) => allowedFormats.includes(fmt))).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('escapeCsvField always returns a string safe for CSV field starts', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const escaped = escapeCsvField(input);
        expect(typeof escaped).toBe('string');
        if (/^[=+\-@]/.test(input)) {
          expect(escaped.startsWith("'") || escaped.startsWith('"')).toBe(true);
        }
        if (
          input.includes(',') ||
          input.includes('"') ||
          input.includes('\n')
        ) {
          expect(escaped.startsWith('"')).toBe(true);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('sanitizeMetaValueForArgs removes null bytes and replacement characters', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const sanitized = sanitizeMetaValueForArgs(input);
        expect(sanitized).not.toContain('\u0000');
        expect(sanitized).not.toContain('\uFFFD');
        expect(sanitized).not.toMatch(/\r/);
      }),
      { numRuns: 200 }
    );
  });

  it('convertLoopPoints returns finite loop values for valid metadata', () => {
    const validRates = [8000, 12000, 16000, 24000, 44100, 48000];

    fc.assert(
      fc.property(
        fc.constantFrom(...validRates),
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        (sampleRate, loopStart, loopLength) => {
          const meta = makeLoopMetadata(sampleRate, loopStart, loopLength);
          const result = convertLoopPoints(meta, 'ogg', 'opus');
          expect(Number.isFinite(result.loopStart)).toBe(true);
          expect(Number.isFinite(result.loopLength)).toBe(true);
          expect(result.loopStart).toBeGreaterThanOrEqual(0);
          expect(result.loopLength).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 150 }
    );
  });

  it('parseCopyFilename extracts -copy(n) suffixes consistently', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
        fc.nat({ max: 99 }),
        (base, num) => {
          const parsed = parseCopyFilename(`${base}-copy(${num}).mp3`);
          expect(parsed.base).toBe(base);
          expect(parsed.num).toBe(num);
        }
      ),
      { numRuns: 100 }
    );
  });
});
