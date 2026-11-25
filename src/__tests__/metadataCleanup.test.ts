/**
 * Regression tests for tags that must not be copied (B13/B14) and for
 * track/disc totals per output format (B27).
 */
import { describe, it, expect } from '@jest/globals';
import { formatMetaDataArgs } from '../metadataService.js';
import type { AudioMetadata } from '../types/metadata.js';

const meta = (
  streamTags: Record<string, string>,
  formatTags: Record<string, string> = {}
): AudioMetadata =>
  ({
    streams: [
      {
        codec_type: 'audio',
        channels: 2,
        sample_rate: '44100',
        tags: streamTags,
      },
    ],
    format: { tags: formatTags },
  }) as unknown as AudioMetadata;

const values = (m: AudioMetadata, format?: string) =>
  formatMetaDataArgs(m, undefined, format).metaDataArgs.filter(
    (_, i) => i % 2 === 1
  );

describe('tags that are never copied', () => {
  it('drops MP4 container housekeeping, the source encoder and iTunes gapless info', () => {
    const v = values(
      meta(
        {
          handler_name: 'SoundHandler',
          vendor_id: '[0][0][0][0]',
          language: 'und',
        },
        {
          title: 'Song',
          major_brand: 'M4A ',
          minor_version: '512',
          compatible_brands: 'M4A isomiso2',
          encoder: 'Lavf61.1.100',
          creation_time: '2024-01-01T00:00:00Z',
          iTunSMPB: ' 00000000 00000840 000001CA',
        }
      ),
      'ogg'
    );
    expect(v).toEqual(['title=Song']);
  });

  it('keeps a real language', () => {
    expect(values(meta({ language: 'eng' }), 'mp3')).toContain('language=eng');
  });
});

describe('track and disc totals', () => {
  const source = meta({}, { track: '3/12', disc: '1/2' });

  it.each(['mp3', 'm4a', 'aiff', 'wav'])(
    'writes "n/total" in the track field for %s',
    (format) => {
      const v = values(source, format);
      expect(v).toEqual(expect.arrayContaining(['track=3/12', 'disc=1/2']));
      expect(v.some((x) => /^(track|disc)_total=/.test(x))).toBe(false);
    }
  );

  it.each(['ogg', 'flac'])('writes TRACKTOTAL/DISCTOTAL for %s', (format) => {
    const v = values(source, format);
    expect(v).toEqual(
      expect.arrayContaining([
        'track=3',
        'TRACKTOTAL=12',
        'disc=1',
        'DISCTOTAL=2',
      ])
    );
    expect(v.some((x) => /^(track|disc)_total=/.test(x))).toBe(false);
  });

  it('reads a FLAC-style TRACKTOTAL source', () => {
    const v = values(meta({}, { TRACKNUMBER: '3', TRACKTOTAL: '12' }), 'mp3');
    expect(v).toContain('track=3/12');
  });
});
