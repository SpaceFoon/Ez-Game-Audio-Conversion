import { convertLoopPoints } from '../metadataService';

// Minimal fake metadata builder
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

describe('convertLoopPoints table cases', () => {
  const baseLoopStart = 1000;
  const baseLoopLength = 4000;

  const cases: Array<
    [
      sampleRate: number,
      expectedRate: number | null,
      expectedStart: number,
      expectedLength: number,
    ]
  > = [
    // >= 32000 -> 48000
    [
      44100,
      48000,
      Math.round(baseLoopStart * (48000 / 44100)),
      Math.round(baseLoopLength * (48000 / 44100)),
    ],
    // between 22050 and <32000 -> 24000
    // 24000 Hz falls into the >=22050 branch which maps to 24000 (no change)
    [
      24000,
      24000,
      Math.round(baseLoopStart * (24000 / 24000)),
      Math.round(baseLoopLength * (24000 / 24000)),
    ],
    [
      22050,
      24000,
      Math.round(baseLoopStart * (24000 / 22050)),
      Math.round(baseLoopLength * (24000 / 22050)),
    ],
    // >16000 to <22050 -> 24000 (same branch as >=22050? original code has else if (sampleRateNumber >= 22050) 24000; else if (sampleRateNumber > 16000) 24000).
    [
      20000,
      24000,
      Math.round(baseLoopStart * (24000 / 20000)),
      Math.round(baseLoopLength * (24000 / 20000)),
    ],
    // >12000 to <=16000 -> 16000
    [
      16000,
      16000,
      Math.round(baseLoopStart * (16000 / 16000)),
      Math.round(baseLoopLength * (16000 / 16000)),
    ],
    [
      13000,
      16000,
      Math.round(baseLoopStart * (16000 / 13000)),
      Math.round(baseLoopLength * (16000 / 13000)),
    ],
    // >8000 to <=12000 -> 12000
    [
      12000,
      12000,
      Math.round(baseLoopStart * (12000 / 12000)),
      Math.round(baseLoopLength * (12000 / 12000)),
    ],
    [
      9000,
      12000,
      Math.round(baseLoopStart * (12000 / 9000)),
      Math.round(baseLoopLength * (12000 / 9000)),
    ],
    // <=8000 -> 8000
    [
      8000,
      8000,
      Math.round(baseLoopStart * (8000 / 8000)),
      Math.round(baseLoopLength * (8000 / 8000)),
    ],
    // <8000 -> 8000
    [
      6000,
      8000,
      Math.round(baseLoopStart * (8000 / 6000)),
      Math.round(baseLoopLength * (8000 / 6000)),
    ],
  ];

  it.each(cases)(
    'adjusts sample rate %d -> %s',
    (sr, expectedRate, expectedStart, expectedLength) => {
      const meta = makeMeta(sr, baseLoopStart, baseLoopLength);
      const { newSampleRate, loopStart, loopLength } = (
        convertLoopPoints as any
      )(meta, 'ogg', 'opus');
      expect(newSampleRate).toBe(expectedRate);
      expect(loopStart).toBe(expectedStart);
      expect(loopLength).toBe(expectedLength);
    }
  );

  it('returns original loop points for non-opus', () => {
    const meta = makeMeta(44100, baseLoopStart, baseLoopLength);
    const res = (convertLoopPoints as any)(meta, 'mp3', 'vorbis');
    expect(res.newSampleRate).toBeNull();
    expect(res.loopStart).toBe(baseLoopStart);
    expect(res.loopLength).toBe(baseLoopLength);
  });

  it('handles missing metadata gracefully', () => {
    const res = (convertLoopPoints as any)(null, 'ogg', 'opus');
    expect(res.loopStart).toBeNaN();
    expect(res.loopLength).toBeNaN();
  });
});
