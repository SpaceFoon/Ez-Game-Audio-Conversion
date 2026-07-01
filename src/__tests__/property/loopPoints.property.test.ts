import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { convertLoopPoints } from '../../metadataService.js';

const makeMeta = (
  sampleRate: number,
  loopStart: number,
  loopLength: number
) => ({
  streams: [
    {
      sample_rate: String(sampleRate),
      channels: 2,
      tags: { LOOPSTART: String(loopStart), LOOPLENGTH: String(loopLength) },
    },
  ],
  format: { tags: {} },
});

describe('convertLoopPoints property tests', () => {
  it('preserves loop points when sample rate is unchanged (non-opus)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8000, max: 96000 }),
        fc.integer({ min: 0, max: 500000 }),
        fc.integer({ min: 1, max: 500000 }),
        (sampleRate, loopStart, loopLength) => {
          const meta = makeMeta(sampleRate, loopStart, loopLength);
          const result = convertLoopPoints(meta, 'mp3', 'vorbis');
          expect(result.loopStart).toBe(loopStart);
          expect(result.loopLength).toBe(loopLength);
          expect(result.newSampleRate).toBeNull();
        }
      ),
      { numRuns: 80 }
    );
  });

  it('opus conversions produce non-negative integer loop points', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8000, max: 96000 }),
        fc.integer({ min: 0, max: 200000 }),
        fc.integer({ min: 1, max: 200000 }),
        (sampleRate, loopStart, loopLength) => {
          const meta = makeMeta(sampleRate, loopStart, loopLength);
          const result = convertLoopPoints(meta, 'ogg', 'opus');
          expect(result.loopStart).toBeGreaterThanOrEqual(0);
          expect(result.loopLength).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(result.loopStart)).toBe(true);
          expect(Number.isInteger(result.loopLength)).toBe(true);
          if (result.newSampleRate !== null) {
            expect(result.newSampleRate).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 80 }
    );
  });

  it('scales loop points when opus upsamples to 48kHz', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 32000, max: 47000 }),
        fc.integer({ min: 100, max: 100000 }),
        fc.integer({ min: 100, max: 100000 }),
        (sampleRate, loopStart, loopLength) => {
          const meta = makeMeta(sampleRate, loopStart, loopLength);
          const result = convertLoopPoints(meta, 'ogg', 'opus');
          expect(result.newSampleRate).toBe(48000);
          const ratio = 48000 / sampleRate;
          expect(result.loopStart).toBe(Math.round(loopStart * ratio));
          expect(result.loopLength).toBe(Math.round(loopLength * ratio));
        }
      ),
      { numRuns: 40 }
    );
  });

  it('never rescales when either loop point is missing (opus path)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8000, max: 96000 }),
        fc.constantFrom('loopStart' as const, 'loopLength' as const),
        (sampleRate, missing) => {
          const tags =
            missing === 'loopStart'
              ? { LOOPLENGTH: '5000' }
              : { LOOPSTART: '1000' };
          const meta = {
            streams: [{ sample_rate: String(sampleRate), channels: 2, tags }],
            format: { tags: {} },
          };
          const result = convertLoopPoints(meta, 'ogg', 'opus');
          expect(result.newSampleRate).toBeNull();
        }
      ),
      { numRuns: 40 }
    );
  });
});
