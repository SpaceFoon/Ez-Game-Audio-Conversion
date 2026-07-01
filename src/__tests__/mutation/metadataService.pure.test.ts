import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import type { AudioMetadata } from '../../types/metadata.js';

jest.unstable_mockModule('../../utils.js', () => ({
  platformSlug: 'windows',
  findBinary: jest.fn(() => '/mock/ffprobe.exe'),
  addToLog: jest.fn(async () => true),
}));

const utils = await import('../../utils.js');
const {
  convertLoopPoints,
  formatMetaDataArgs,
  getLoopPoints,
  sanitizeMetaValueForArgs,
} = await import('../../metadataService.js');

const addToLogMock = utils.addToLog as unknown as jest.Mock;

const asMeta = (value: unknown): AudioMetadata => value as AudioMetadata;

describe('metadataService pure logic (mutation hardening)', () => {
  const originalConsole = { error: console.error, warn: console.warn };

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });

  describe('sanitizeMetaValueForArgs', () => {
    it('collapses CRLF and lone CR into spaces', () => {
      expect(sanitizeMetaValueForArgs('a\r\nb\rc')).toBe('a b c');
    });
  });

  describe('getLoopPoints tag variants', () => {
    it('reads loop_start variant from format tags', () => {
      const metadata = asMeta({
        format: {
          tags: {
            loop_start: '42',
            loop_length: '99',
          },
        },
      });

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(42);
      expect(loopLength).toBe(99);
    });

    it('reads lowercase itunes loop tags from stream tags', () => {
      const metadata = asMeta({
        streams: [
          {
            tags: {
              itunes_loopstart: '10',
              itunes_looplength: '20',
            },
          },
        ],
      });

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(10);
      expect(loopLength).toBe(20);
    });
  });

  describe('convertLoopPoints edge branches', () => {
    it('returns early when only loopStart is missing', () => {
      const metadata = asMeta({
        streams: [
          {
            sample_rate: '44100',
            tags: { LOOPLENGTH: '5000' },
          },
        ],
      });

      const result = convertLoopPoints(metadata, 'ogg', 'opus');
      expect(result.newSampleRate).toBeNull();
      expect(result.loopStart).toBeNaN();
      expect(result.loopLength).toBe(5000);
    });

    it('returns early when only loopLength is missing', () => {
      const metadata = asMeta({
        streams: [
          {
            sample_rate: '44100',
            tags: { LOOPSTART: '1000' },
          },
        ],
      });

      const result = convertLoopPoints(metadata, 'ogg', 'opus');
      expect(result.newSampleRate).toBeNull();
      expect(result.loopStart).toBe(1000);
      expect(result.loopLength).toBeNaN();
    });

    it('returns NaN loop points when streams array is empty', () => {
      const result = convertLoopPoints(asMeta({ streams: [] }), 'ogg', 'opus');
      expect(result.newSampleRate).toBeNull();
      expect(result.loopStart).toBeNaN();
      expect(result.loopLength).toBeNaN();
    });

    it('does not rescale loops for mp3 even at high sample rates', () => {
      const metadata = asMeta({
        streams: [
          {
            sample_rate: '96000',
            tags: { LOOPSTART: '1000', LOOPLENGTH: '4000' },
          },
        ],
      });

      const result = convertLoopPoints(metadata, 'mp3', 'vorbis');
      expect(result.newSampleRate).toBeNull();
      expect(result.loopStart).toBe(1000);
      expect(result.loopLength).toBe(4000);
    });

    it('returns opus target sample rate even when input is already 48kHz', () => {
      const metadata = asMeta({
        streams: [
          {
            sample_rate: '48000',
            tags: { LOOPSTART: '1000', LOOPLENGTH: '4000' },
          },
        ],
      });

      const result = convertLoopPoints(metadata, 'ogg', 'opus');
      expect(result.newSampleRate).toBe(48000);
      expect(result.loopStart).toBe(1000);
      expect(result.loopLength).toBe(4000);
    });
  });

  describe('formatMetaDataArgs canonical aliases and merges', () => {
    const aliasCases: Array<[alias: string, canonical: string, value: string]> =
      [
        ['trackno', 'track', '3'],
        ['discnumber', 'disc', '2'],
        ['totaltracks', 'track_total', '12'],
        ['totaldiscs', 'disc_total', '2'],
        ['albumartist', 'album_artist', 'Various'],
        ['encodedby', 'encoded_by', 'Ez Game'],
        ['year', 'date', '1999'],
        ['episodeid', 'episode_id', 'ep-1'],
      ];

    it.each(aliasCases)(
      'maps alias %s to canonical %s',
      (alias, canonical, value) => {
        const { metaDataArgs } = formatMetaDataArgs(
          asMeta({
            streams: [{ channels: 2, tags: { [alias]: value } }],
          })
        );
        expect(metaDataArgs.join(' ')).toContain(`${canonical}=${value}`);
      }
    );

    it('parses track slash notation into track and track_total', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { tracknumber: '4/11' } }],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).toContain('track=4');
      expect(joined).toContain('track_total=11');
    });

    it('parses disc "n of m" notation into disc and disc_total', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { discnumber: '2 of 3' } }],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).toContain('disc=2');
      expect(joined).toContain('disc_total=3');
    });

    it('parses multi-digit slash notation exactly', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { tracknumber: '14/115' } }],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).toContain('track=14');
      expect(joined).toContain('track_total=115');
    });

    it('trims whitespace before parsing slash notation', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { tracknumber: '  4 / 11  ' } }],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).toContain('track=4');
      expect(joined).toContain('track_total=11');
    });

    it('does not treat slash notation with trailing junk as track totals', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { tracknumber: '4/11 extra' } }],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).not.toContain('track_total=11');
      expect(joined).toContain('track=4/11 extra');
    });

    it('does not split slash notation on non-track canonical fields', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { title: '4/11' } }],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).toContain('title=4/11');
      expect(joined).not.toContain('track_total=11');
    });

    it('rejects slash values missing the total segment', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { tracknumber: '4/' } }],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).not.toContain('track_total=');
      expect(joined).toContain('track=4/');
    });

    it('does not treat disc values with trailing junk as disc totals', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { discnumber: '2 of 3 extra' } }],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).not.toContain('disc_total=3');
    });

    it('skips null and undefined tag values', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [
            {
              channels: 2,
              tags: {
                title: 'Kept',
                artist: undefined,
                album: null,
              },
            },
          ],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).toContain('title=Kept');
      expect(joined).not.toContain('artist=');
      expect(joined).not.toContain('album=');
    });

    it('skips empty tags but keeps explicit zero values', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [
            {
              channels: 2,
              tags: {
                comment: '',
                bpm: '0',
              },
            },
          ],
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).not.toContain('comment=');
      expect(joined).toContain('bpm=0');
    });

    it('keeps the first passthrough key when duplicate normalized keys tie on replacement chars', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: {} }],
          format: {
            tags: {
              CUSTOM_A: 'same',
              custom_a: 'other',
            },
          },
        })
      );

      const joined = metaDataArgs.join(' ');
      expect(joined).toContain('CUSTOM_A=same');
      expect(joined).not.toContain('custom_a=other');
    });

    it('keeps the first canonical value when replacement-char counts tie', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { title: 'A\uFFFDB' } }],
          format: { tags: { title: 'C\uFFFDD' } },
        })
      );

      expect(metaDataArgs.join(' ')).toContain('title=AB');
      expect(metaDataArgs.join(' ')).not.toContain('title=CD');
    });

    it('does not prefer a candidate with more replacement characters', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { title: 'Clean' } }],
          format: { tags: { title: 'Bad\uFFFDC' } },
        })
      );

      expect(metaDataArgs.join(' ')).toContain('title=Clean');
    });

    it('keeps the first canonical track value when a second tag arrives later', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { tracknumber: '1' } }],
          format: { tags: { tracknumber: '2' } },
        })
      );

      expect(metaDataArgs.join(' ')).toContain('track=1');
      expect(metaDataArgs.join(' ')).not.toContain('track=2');
    });

    it('skips passthrough tags that become empty after cleanup', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: {} }],
          format: { tags: { CUSTOM_TAG: '\uFFFD' } },
        }),
        'empty-after-clean.wav'
      );

      expect(metaDataArgs.join(' ')).not.toContain('CUSTOM_TAG=');
    });

    it('logs CSV write failures during metadata cleanup warnings', async () => {
      addToLogMock.mockRejectedValueOnce(new Error('disk full'));

      formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { title: 'Bad\uFFFDC' } }],
        }),
        'warn-me.wav'
      );

      await Promise.resolve();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write metadata cleanup warning'),
        'disk full'
      );
    });

    it('prefers stream tag without replacement chars over format tag with them', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { title: 'Clean Title' } }],
          format: { tags: { title: 'Bad\uFFFDC Title' } },
        }),
        'merge.flac'
      );

      expect(metaDataArgs.join(' ')).toContain('title=Clean Title');
      expect(metaDataArgs.join(' ')).not.toContain('\uFFFD');
    });

    it('preserves zero-valued canonical tags', () => {
      const { metaDataArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 2, tags: { bpm: '0' } }],
        })
      );

      expect(metaDataArgs.join(' ')).toContain('bpm=0');
    });

    it('warns when metadata is missing but input file is provided', () => {
      const result = formatMetaDataArgs(null, 'missing-tags.wav');
      expect(result.metaDataArgs).toEqual([]);
      expect(result.channelsArgs).toEqual(['-ac', '2']);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing-tags.wav')
      );
    });

    it('does not warn when metadata is missing and no input file is provided', () => {
      const result = formatMetaDataArgs(null);
      expect(result.metaDataArgs).toEqual([]);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('uses explicit channel count from first stream', () => {
      const { channelsArgs } = formatMetaDataArgs(
        asMeta({
          streams: [{ channels: 6, tags: { title: 'Surround' } }],
        })
      );

      expect(channelsArgs).toEqual(['-ac', '6']);
    });
  });
});
