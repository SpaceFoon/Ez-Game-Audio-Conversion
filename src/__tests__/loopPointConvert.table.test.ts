import { convertLoopPoints } from '../metadataService.ts';

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

  it.each([
    [8000, 8000],
    [12000, 12000],
    [16000, 16000],
    [32000, 48000],
  ])(
    'handles opus boundary sample rate %d -> %d explicitly',
    (sampleRate, expectedRate) => {
      const meta = makeMeta(sampleRate, baseLoopStart, baseLoopLength);
      const ratio = expectedRate / sampleRate;
      const res = (convertLoopPoints as any)(meta, 'ogg', 'opus');

      expect(res.newSampleRate).toBe(expectedRate);
      expect(res.loopStart).toBe(Math.round(baseLoopStart * ratio));
      expect(res.loopLength).toBe(Math.round(baseLoopLength * ratio));
    }
  );

  it('does not apply opus sample-rate rules to mp3 even when oggCodec is opus', () => {
    const meta = makeMeta(44100, baseLoopStart, baseLoopLength);
    const res = convertLoopPoints(meta as any, 'mp3', 'opus');

    expect(res.newSampleRate).toBeNull();
    expect(res.loopStart).toBe(baseLoopStart);
    expect(res.loopLength).toBe(baseLoopLength);
  });

  it('returns null sample rate when either loop point is NaN during opus conversion', () => {
    const meta = {
      streams: [
        {
          sample_rate: '44100',
          channels: 2,
          tags: { LOOPSTART: '1000' },
        },
      ],
      format: { tags: {} },
    };
    const res = convertLoopPoints(meta as any, 'ogg', 'opus');

    expect(res.newSampleRate).toBeNull();
    expect(res.loopStart).toBe(1000);
    expect(res.loopLength).toBeNaN();
  });

  it('returns original loop points for ogg when codec is not opus', () => {
    const meta = makeMeta(44100, baseLoopStart, baseLoopLength);
    const res = (convertLoopPoints as any)(meta, 'ogg', 'vorbis');

    expect(res.newSampleRate).toBeNull();
    expect(res.loopStart).toBe(baseLoopStart);
    expect(res.loopLength).toBe(baseLoopLength);
  });

  it('handles missing metadata gracefully', () => {
    const res = (convertLoopPoints as any)(null, 'ogg', 'opus');
    expect(res.loopStart).toBeNaN();
    expect(res.loopLength).toBeNaN();
  });

  it('ignores non-numeric loop tags', () => {
    const meta = {
      streams: [
        {
          sample_rate: '44100',
          channels: 2,
          tags: { LOOPSTART: 'not-a-number', LOOPLENGTH: 'also-bad' },
        },
      ],
      format: { tags: {} },
    };
    const res = convertLoopPoints(meta as any, 'mp3', 'vorbis');
    expect(res.loopStart).toBeNaN();
    expect(res.loopLength).toBeNaN();
  });

  it('treats zero loop start and length as no loop', () => {
    const meta = makeMeta(44100, 0, 0);
    const res = convertLoopPoints(meta as any, 'mp3', 'vorbis');
    expect(res.loopStart).toBe(0);
    expect(res.loopLength).toBe(0);
  });

  it('uses only the first audio stream for loop conversion', () => {
    const meta = {
      streams: [
        {
          sample_rate: '44100',
          channels: 2,
          tags: { LOOPSTART: '100', LOOPLENGTH: '200' },
        },
        {
          sample_rate: '48000',
          channels: 2,
          tags: { LOOPSTART: '999', LOOPLENGTH: '888' },
        },
      ],
      format: { tags: {} },
    };
    const res = convertLoopPoints(meta as any, 'mp3', 'vorbis');
    expect(res.loopStart).toBe(100);
    expect(res.loopLength).toBe(200);
  });
});
