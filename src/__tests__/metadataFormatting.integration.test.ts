/**
 * Integration tests for metadata formatting functions
 * Tests ACTUAL string/array output - no mocks!
 *
 * These tests verify the real output that would be passed to ffmpeg,
 * catching bugs that mocked tests miss.
 */

import {
  formatMetaDataArgs,
  getLoopPoints,
  convertLoopPoints,
  formatLoopData,
} from '../metadataService.js';
import type { AudioMetadata } from '../types/metadata.js';

describe('formatMetaDataArgs - Real Output Tests', () => {
  describe('basic metadata extraction', () => {
    it('should extract title and artist from stream tags', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: 'Test Song',
              artist: 'Test Artist',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.metaDataArgs).toContain('-metadata');
      expect(result.metaDataArgs).toContain('title=Test Song');
      expect(result.metaDataArgs).toContain('artist=Test Artist');
      expect(result.channelsArgs).toEqual(['-ac', '2']);
    });

    it('should extract title and artist from format tags when stream tags missing', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'mp3',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
          },
        ],
        format: {
          filename: 'test.mp3',
          format_name: 'mp3',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
          tags: {
            title: 'Format Title',
            artist: 'Format Artist',
          },
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.metaDataArgs).toContain('title=Format Title');
      expect(result.metaDataArgs).toContain('artist=Format Artist');
    });

    it('should handle UPPERCASE tags (common in FLAC)', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'flac',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '96000',
            tags: {
              TITLE: 'FLAC Title',
              ARTIST: 'FLAC Artist',
              ALBUM: 'FLAC Album',
            },
          },
        ],
        format: {
          filename: 'test.flac',
          format_name: 'flac',
          duration: '300.0',
          size: '50000000',
          bit_rate: '1411000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.metaDataArgs).toContain('title=FLAC Title');
      expect(result.metaDataArgs).toContain('artist=FLAC Artist');
      expect(result.metaDataArgs).toContain('album=FLAC Album');
    });

    it('should preserve "track" field name (ffmpeg standard)', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              track: '5',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      // ffmpeg uses 'track' as the standard field name
      expect(result.metaDataArgs).toContain('track=5');
    });
  });

  describe('escaping dangerous characters', () => {
    it('should escape backslashes', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: 'Path\\To\\File',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      // With spawn args array (shell: false), backslashes are preserved as-is
      expect(result.metaDataArgs).toContain('title=Path\\To\\File');
    });

    it('should escape double quotes', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: 'Song "With" Quotes',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      // With spawn args array (shell: false), quotes are preserved as-is
      expect(result.metaDataArgs).toContain('title=Song "With" Quotes');
    });

    it('should convert Windows newlines to escaped \\n', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              comment: 'Line 1\r\nLine 2\r\nLine 3',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      // With spawn args array (shell: false), newlines are normalized to \n and preserved
      expect(result.metaDataArgs).toContain('comment=Line 1\nLine 2\nLine 3');
    });

    it('should convert Unix newlines to escaped \\n', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              lyrics: 'Verse 1\nChorus\nVerse 2',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      // With spawn args array (shell: false), newlines are preserved as-is
      expect(result.metaDataArgs).toContain('lyrics=Verse 1\nChorus\nVerse 2');
    });

    it('should convert old Mac newlines (CR only) to escaped \\n', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              comment: 'Old\rMac\rStyle',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      // With spawn args array (shell: false), CR is normalized to LF
      expect(result.metaDataArgs).toContain('comment=Old\nMac\nStyle');
    });

    it('should remove null bytes', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: 'Has\u0000Null\u0000Bytes',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.metaDataArgs).toContain('title=HasNullBytes');
    });

    it('should handle complex escaping combinations', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              comment: 'Path: C:\\Music\\"Best" Songs\r\nLine 2',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      // With spawn args array (shell: false), chars are preserved; newlines normalized
      expect(result.metaDataArgs).toContain(
        'comment=Path: C:\\Music\\"Best" Songs\nLine 2'
      );
    });
  });

  describe('Unicode handling', () => {
    it('should preserve Japanese characters', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: '桜の花びらたち',
              artist: 'ゲーム音楽',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.metaDataArgs).toContain('title=桜の花びらたち');
      expect(result.metaDataArgs).toContain('artist=ゲーム音楽');
    });

    it('should preserve Chinese characters', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: '游戏音乐',
              album: '原声带',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.metaDataArgs).toContain('title=游戏音乐');
      expect(result.metaDataArgs).toContain('album=原声带');
    });

    it('should preserve Korean characters', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: '게임 음악',
              artist: '작곡가',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.metaDataArgs).toContain('title=게임 음악');
      expect(result.metaDataArgs).toContain('artist=작곡가');
    });

    it('should preserve emoji', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: '🎵 Music Track 🎶',
              comment: '❤️ Favorite song! 🔥',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.metaDataArgs).toContain('title=🎵 Music Track 🎶');
      expect(result.metaDataArgs).toContain('comment=❤️ Favorite song! 🔥');
    });
  });

  describe('channel handling', () => {
    it('should detect mono audio', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 1,
            sample_rate: '44100',
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.channelsArgs).toEqual(['-ac', '1']);
    });

    it('should detect stereo audio', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.channelsArgs).toEqual(['-ac', '2']);
    });

    it('should detect 5.1 surround', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'aac',
            codec_type: 'audio',
            channels: 6,
            sample_rate: '48000',
          },
        ],
        format: {
          filename: 'test.m4a',
          format_name: 'mov',
          duration: '180.5',
          size: '1234567',
          bit_rate: '384000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.channelsArgs).toEqual(['-ac', '6']);
    });

    it('should default to stereo when channels missing', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            sample_rate: '44100',
          } as any, // Missing channels property
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.channelsArgs).toEqual(['-ac', '2']);
    });
  });

  describe('edge cases', () => {
    it('should handle null metadata', () => {
      const result = formatMetaDataArgs(null);

      expect(result.metaDataArgs).toEqual([]);
      expect(result.channelsArgs).toEqual(['-ac', '2']);
    });

    it('should handle metadata with no streams', () => {
      const metadata: AudioMetadata = {
        streams: [],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      expect(result.metaDataArgs).toEqual([]);
      expect(result.channelsArgs).toEqual(['-ac', '2']);
    });

    it('should handle empty tag values', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: '',
              artist: '   ', // whitespace only
              album: 'Valid Album',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      // Empty and whitespace-only values should be excluded
      expect(result.metaDataArgs).not.toContain('title=');
      expect(result.metaDataArgs).not.toContain('artist=');
      expect(result.metaDataArgs).toContain('album=Valid Album');
    });

    it('should produce valid ffmpeg argument array structure', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              title: 'Test',
              artist: 'Artist',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = formatMetaDataArgs(metadata);

      // Verify structure: alternating -metadata and key=value pairs
      for (let i = 0; i < result.metaDataArgs.length; i += 2) {
        expect(result.metaDataArgs[i]).toBe('-metadata');
        expect(result.metaDataArgs[i + 1]).toMatch(/^[a-z_]+=.+$/i);
      }
    });
  });
});

describe('getLoopPoints - Real Output Tests', () => {
  it('should extract LOOPSTART and LOOPLENGTH from stream tags', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'vorbis',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {
            LOOPSTART: '12345',
            LOOPLENGTH: '67890',
          },
        },
      ],
      format: {
        filename: 'test.ogg',
        format_name: 'ogg',
        duration: '180.5',
        size: '1234567',
        bit_rate: '128000',
      },
    };

    const result = getLoopPoints(metadata);

    expect(result.loopStart).toBe(12345);
    expect(result.loopLength).toBe(67890);
  });

  it('should extract lowercase loopstart and looplength', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'vorbis',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {
            loopstart: '11111',
            looplength: '22222',
          },
        },
      ],
      format: {
        filename: 'test.ogg',
        format_name: 'ogg',
        duration: '180.5',
        size: '1234567',
        bit_rate: '128000',
      },
    };

    const result = getLoopPoints(metadata);

    expect(result.loopStart).toBe(11111);
    expect(result.loopLength).toBe(22222);
  });

  it('should extract loop points from format tags when stream tags missing', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'vorbis',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
        },
      ],
      format: {
        filename: 'test.ogg',
        format_name: 'ogg',
        duration: '180.5',
        size: '1234567',
        bit_rate: '128000',
        tags: {
          LOOPSTART: '33333',
          LOOPLENGTH: '44444',
        },
      },
    };

    const result = getLoopPoints(metadata);

    expect(result.loopStart).toBe(33333);
    expect(result.loopLength).toBe(44444);
  });

  it('should return NaN for missing loop points', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'vorbis',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {
            title: 'No Loop Points',
          },
        },
      ],
      format: {
        filename: 'test.ogg',
        format_name: 'ogg',
        duration: '180.5',
        size: '1234567',
        bit_rate: '128000',
      },
    };

    const result = getLoopPoints(metadata);

    expect(result.loopStart).toBeNaN();
    expect(result.loopLength).toBeNaN();
  });

  it('should return NaN for null metadata', () => {
    const result = getLoopPoints(null);

    expect(result.loopStart).toBeNaN();
    expect(result.loopLength).toBeNaN();
  });
});

describe('convertLoopPoints - Real Output Tests', () => {
  describe('non-opus formats (no conversion)', () => {
    it('should return original loop points for mp3 format', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'mp3',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              LOOPSTART: '10000',
              LOOPLENGTH: '50000',
            },
          },
        ],
        format: {
          filename: 'test.mp3',
          format_name: 'mp3',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = convertLoopPoints(metadata, 'mp3', 'libmp3lame');

      expect(result.newSampleRate).toBeNull();
      expect(result.loopStart).toBe(10000);
      expect(result.loopLength).toBe(50000);
    });

    it('should return original loop points for ogg vorbis', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              LOOPSTART: '10000',
              LOOPLENGTH: '50000',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = convertLoopPoints(metadata, 'ogg', 'vorbis');

      expect(result.newSampleRate).toBeNull();
      expect(result.loopStart).toBe(10000);
      expect(result.loopLength).toBe(50000);
    });
  });

  describe('opus conversion (sample rate changes)', () => {
    it('should convert 44100Hz to 48000Hz for opus', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
            tags: {
              LOOPSTART: '44100', // 1 second
              LOOPLENGTH: '88200', // 2 seconds
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = convertLoopPoints(metadata, 'ogg', 'opus');

      expect(result.newSampleRate).toBe(48000);
      // 44100 * (48000/44100) = 48000
      expect(result.loopStart).toBe(48000);
      // 88200 * (48000/44100) = 96000
      expect(result.loopLength).toBe(96000);
    });

    it('should convert 48000Hz to 48000Hz for opus (no change)', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '48000',
            tags: {
              LOOPSTART: '48000',
              LOOPLENGTH: '96000',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = convertLoopPoints(metadata, 'ogg', 'opus');

      expect(result.newSampleRate).toBe(48000);
      expect(result.loopStart).toBe(48000);
      expect(result.loopLength).toBe(96000);
    });

    it('should convert 22050Hz to 24000Hz for opus', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '22050',
            tags: {
              LOOPSTART: '22050', // 1 second
              LOOPLENGTH: '44100', // 2 seconds
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = convertLoopPoints(metadata, 'ogg', 'opus');

      expect(result.newSampleRate).toBe(24000);
      // 22050 * (24000/22050) ≈ 24000
      expect(result.loopStart).toBe(Math.round(22050 * (24000 / 22050)));
      expect(result.loopLength).toBe(Math.round(44100 * (24000 / 22050)));
    });

    it('should convert 8000Hz to 8000Hz for opus (low sample rate)', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '8000',
            tags: {
              LOOPSTART: '8000',
              LOOPLENGTH: '16000',
            },
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '32000',
        },
      };

      const result = convertLoopPoints(metadata, 'ogg', 'opus');

      expect(result.newSampleRate).toBe(8000);
      expect(result.loopStart).toBe(8000);
      expect(result.loopLength).toBe(16000);
    });
  });

  describe('edge cases', () => {
    it('should handle null metadata', () => {
      const result = convertLoopPoints(null, 'ogg', 'opus');

      expect(result.newSampleRate).toBeNull();
      expect(result.loopStart).toBeNaN();
      expect(result.loopLength).toBeNaN();
    });

    it('should handle metadata without loop points', () => {
      const metadata: AudioMetadata = {
        streams: [
          {
            index: 0,
            codec_name: 'vorbis',
            codec_type: 'audio',
            channels: 2,
            sample_rate: '44100',
          },
        ],
        format: {
          filename: 'test.ogg',
          format_name: 'ogg',
          duration: '180.5',
          size: '1234567',
          bit_rate: '128000',
        },
      };

      const result = convertLoopPoints(metadata, 'ogg', 'opus');

      expect(result.loopStart).toBeNaN();
      expect(result.loopLength).toBeNaN();
    });
  });
});

describe('formatLoopData - Real Output Tests', () => {
  it('should format loop data for ffmpeg as args array', () => {
    const result = formatLoopData(12345, 67890);

    expect(result).toEqual([
      '-metadata',
      'LOOPSTART=12345',
      '-metadata',
      'LOOPLENGTH=67890',
      '-metadata',
      'loopstart=12345',
      '-metadata',
      'looplength=67890',
    ]);
  });

  it('should return empty array for NaN loop start', () => {
    const result = formatLoopData(NaN, 67890);

    expect(result).toEqual([]);
  });

  it('should return empty array for NaN loop length', () => {
    const result = formatLoopData(12345, NaN);

    expect(result).toEqual([]);
  });

  it('should return empty array for both NaN', () => {
    const result = formatLoopData(NaN, NaN);

    expect(result).toEqual([]);
  });

  it('should handle zero values (valid loop points)', () => {
    const result = formatLoopData(0, 100000);

    expect(result).toEqual([
      '-metadata',
      'LOOPSTART=0',
      '-metadata',
      'LOOPLENGTH=100000',
      '-metadata',
      'loopstart=0',
      '-metadata',
      'looplength=100000',
    ]);
  });

  it('should produce valid ffmpeg argument array', () => {
    const result = formatLoopData(48000, 96000);

    // Should be usable directly spread into ffmpeg args
    expect(result).toEqual(
      expect.arrayContaining(['-metadata', 'LOOPSTART=48000'])
    );
    expect(result).toEqual(
      expect.arrayContaining(['-metadata', 'LOOPLENGTH=96000'])
    );
    expect(result.length).toBe(8);
  });
});

// Additional preservation-focused scenarios requested post-review
describe('formatMetaDataArgs - Preservation scenarios', () => {
  it('should prefer non-replacement-character performer value when duplicates conflict', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'aiff',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {
            Performer: '�B',
          },
        },
      ],
      format: {
        filename: 'performer.aiff',
        format_name: 'aiff',
        duration: '180',
        size: '1234',
        bit_rate: '256000',
        tags: {
          PERFORMER: 'µB',
        },
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');

    expect(joined).toContain('performer=µB');
    expect(joined).not.toContain('performer=�B');
  });

  it('should normalize common aliases to canonical ffmpeg keys', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'mp3',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {
            TRACKNUMBER: '7',
            DISCNUMBER: '2',
            ALBUMARTIST: 'Lead Composer',
            TDRC: '2025',
          },
        },
      ],
      format: {
        filename: 'aliases.mp3',
        format_name: 'mp3',
        duration: '180',
        size: '777777',
        bit_rate: '192000',
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');

    expect(joined).toContain('track=7');
    expect(joined).toContain('disc=2');
    expect(joined).toContain('album_artist=Lead Composer');
    expect(joined).toContain('date=2025');
    expect(joined).not.toContain('TRACKNUMBER=7');
    expect(joined).not.toContain('DISCNUMBER=2');
    expect(joined).not.toContain('ALBUMARTIST=Lead Composer');
    expect(joined).not.toContain('TDRC=2025');
  });

  it('should split track and disc totals from slash-separated values', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'flac',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '48000',
          tags: {
            track: '3/11',
            disc: '1/2',
          },
        },
      ],
      format: {
        filename: 'totals.flac',
        format_name: 'flac',
        duration: '240',
        size: '333333',
        bit_rate: '800000',
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');

    expect(joined).toContain('track=3');
    expect(joined).toContain('track_total=11');
    expect(joined).toContain('disc=1');
    expect(joined).toContain('disc_total=2');
  });

  it('should split track totals from "N of M" values', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'aac',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {
            track: '5 of 12',
          },
        },
      ],
      format: {
        filename: 'track-of.m4a',
        format_name: 'mov',
        duration: '180',
        size: '888888',
        bit_rate: '256000',
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');

    expect(joined).toContain('track=5');
    expect(joined).toContain('track_total=12');
  });

  it('should reject unsafe passthrough tag keys while preserving safe unknown keys', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'vorbis',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '48000',
          tags: {
            SAFE_CUSTOM: 'keep-me',
            'unsafe key': 'drop-me',
            'another@unsafe': 'drop-me-too',
          },
        },
      ],
      format: {
        filename: 'unsafe.ogg',
        format_name: 'ogg',
        duration: '60',
        size: '1000',
        bit_rate: '128000',
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');

    expect(joined).toContain('SAFE_CUSTOM=keep-me');
    expect(joined).not.toContain('unsafe key=drop-me');
    expect(joined).not.toContain('another@unsafe=drop-me-too');
  });

  it('should keep only the cleaner value for duplicate unknown keys with the same normalized form', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'vorbis',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '48000',
          tags: {
            'X Foo': 'bad�value',
          },
        },
      ],
      format: {
        filename: 'dup-unknown.ogg',
        format_name: 'ogg',
        duration: '60',
        size: '1000',
        bit_rate: '128000',
        tags: {
          'X-FOO': 'good-value',
        },
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');

    expect(joined).toContain('X-FOO=good-value');
    expect(joined).not.toContain('X Foo=bad�value');
  });

  it('should skip canonical tags that become empty after replacement-character cleanup', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'aiff',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {
            performer: '��',
            title: 'Still Valid',
          },
        },
      ],
      format: {
        filename: 'cleanup.aiff',
        format_name: 'aiff',
        duration: '180',
        size: '1234',
        bit_rate: '256000',
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');

    expect(joined).toContain('title=Still Valid');
    expect(joined).not.toContain('performer=');
  });

  it('should prefer stream canonical values unless the format value is demonstrably cleaner', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'flac',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '96000',
          tags: {
            artist: 'Stream Artist',
          },
        },
      ],
      format: {
        filename: 'priority.flac',
        format_name: 'flac',
        duration: '180',
        size: '555555',
        bit_rate: '1000000',
        tags: {
          artist: 'Format Artist',
        },
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');

    expect(joined).toContain('artist=Stream Artist');
    expect(joined).not.toContain('artist=Format Artist');
  });

  it('should round-trip extra/unknown tags unchanged', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'vorbis',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '48000',
          tags: {
            title: 'Tag Test',
            GAME_ENGINE: 'Frostbite',
            'X-FOO': 'bar',
            'X-UNKNOWN': 'keep-me',
          },
        },
      ],
      format: {
        filename: 'test.ogg',
        format_name: 'ogg',
        duration: '120',
        size: '123456',
        bit_rate: '160000',
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');

    expect(joined).toContain('GAME_ENGINE=Frostbite');
    expect(joined).toContain('X-FOO=bar');
    expect(joined).toContain('X-UNKNOWN=keep-me');
  });

  it('should preserve multiple artists', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'flac',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {
            artist: 'Alice,Bob',
          },
        },
      ],
      format: {
        filename: 'multi.flac',
        format_name: 'flac',
        duration: '200',
        size: '234567',
        bit_rate: '900000',
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    expect(metaDataArgs.join(' ')).toContain('artist=Alice,Bob');
  });

  it('should keep artwork-related tags', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'vorbis',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '48000',
          tags: {
            METADATA_BLOCK_PICTURE: 'AAAABBBB',
            attached_pic: 'cover.jpeg',
          },
        },
      ],
      format: {
        filename: 'art.ogg',
        format_name: 'ogg',
        duration: '60',
        size: '654321',
        bit_rate: '128000',
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');
    expect(joined).toContain('METADATA_BLOCK_PICTURE=AAAABBBB');
    expect(joined).toContain('attached_pic=cover.jpeg');
  });

  it('should keep date fields distinct (date, original_date, release_date)', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'mp3',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
        },
      ],
      format: {
        filename: 'dates.mp3',
        format_name: 'mp3',
        duration: '180',
        size: '111111',
        bit_rate: '192000',
        tags: {
          date: '2024-01-01',
          original_date: '1999-02-02',
          release_date: '2023-03-03',
        },
      },
    };

    const { metaDataArgs } = formatMetaDataArgs(metadata);
    const joined = metaDataArgs.join(' ');
    expect(joined).toContain('date=2024-01-01');
    expect(joined).toContain('original_date=1999-02-02');
    expect(joined).toContain('release_date=2023-03-03');
  });
});

describe('convertLoopPoints - Loop preservation detail', () => {
  it('should preserve loop integrity when resampling 44.1k -> 48k opus', () => {
    const metadata: AudioMetadata = {
      streams: [
        {
          index: 0,
          codec_name: 'pcm_s16le',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {
            LOOPSTART: '1000000',
            LOOPLENGTH: '2000000',
          },
        },
      ],
      format: {
        filename: 'loop.wav',
        format_name: 'wav',
        duration: '400',
        size: '123',
        bit_rate: '1411200',
      },
    };

    const result = convertLoopPoints(metadata, 'ogg', 'opus');

    expect(result.newSampleRate).toBe(48000);
    expect(result.loopStart).toBe(1088435);
    expect(result.loopLength).toBe(2176871);

    // Ensure formatted loop metadata reflects converted values
    const loopArgs = formatLoopData(result.loopStart, result.loopLength);
    expect(loopArgs).toContain('LOOPSTART=1088435');
    expect(loopArgs).toContain('LOOPLENGTH=2176871');
  });
});
