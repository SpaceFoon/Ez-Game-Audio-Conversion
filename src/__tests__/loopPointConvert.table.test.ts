import { jest } from '@jest/globals';
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

  // Opus always decodes at 48 kHz, so every source rate is encoded at
  // 48 kHz and loop points are scaled to 48 kHz units.
  const cases: Array<
    [
      sampleRate: number,
      expectedRate: number | null,
      expectedStart: number,
      expectedLength: number,
    ]
  > = [6000, 8000, 9000, 12000, 13000, 16000, 20000, 22050, 24000, 44100].map(
    (sr) => [
      sr,
      48000,
      Math.round(baseLoopStart * (48000 / sr)),
      Math.round(baseLoopLength * (48000 / sr)),
    ]
  );

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
    [8000, 48000],
    [12000, 48000],
    [16000, 48000],
    [32000, 48000],
    [48000, 48000],
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

  it('keeps the explicit 48 kHz rate and scales a lone loop start during opus conversion', () => {
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

    expect(res.newSampleRate).toBe(48000);
    expect(res.loopStart).toBe(Math.round(1000 * (48000 / 44100)));
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
    console.error = jest.fn();
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

  it('rescales mp3 loop points when the source rate is above 48 kHz', () => {
    const meta = makeMeta(96000, baseLoopStart, baseLoopLength);
    const res = convertLoopPoints(meta as any, 'mp3', 'vorbis');
    expect(res.newSampleRate).toBe(48000);
    expect(res.loopStart).toBe(500);
    expect(res.loopLength).toBe(2000);
  });

  it('reads loop tags in any letter case and LOOPEND instead of LOOPLENGTH', () => {
    const meta = {
      streams: [
        {
          codec_type: 'audio',
          sample_rate: '44100',
          channels: 2,
          tags: { LoopStart: '100', LOOP_END: '2100' },
        },
      ],
      format: { tags: {} },
    };
    const res = convertLoopPoints(meta as any, 'flac', 'vorbis');
    expect(res.loopStart).toBe(100);
    expect(res.loopLength).toBe(2000);
    expect(res.hasLoopEnd).toBe(true);
  });

  it('skips a cover-art stream listed before the audio stream', () => {
    const meta = {
      streams: [
        { codec_type: 'video', tags: { LOOPSTART: '1', LOOPLENGTH: '2' } },
        {
          codec_type: 'audio',
          sample_rate: '96000',
          channels: 1,
          tags: { LOOPSTART: '9600', LOOPLENGTH: '48000' },
        },
      ],
      format: { tags: {} },
    };
    const res = convertLoopPoints(meta as any, 'mp3', 'vorbis');
    expect(res.newSampleRate).toBe(48000);
    expect(res.loopStart).toBe(4800);
    expect(res.loopLength).toBe(24000);
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
