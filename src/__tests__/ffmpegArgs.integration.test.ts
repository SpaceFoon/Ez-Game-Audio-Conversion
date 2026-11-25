/**
 * Integration tests for ffmpeg argument building
 *
 * These tests verify the ACTUAL argument arrays that would be passed to ffmpeg,
 * by capturing spawn() calls with minimal mocking.
 *
 * Unlike the fully-mocked tests, these use REAL metadata processing and only
 * mock the filesystem and spawn to capture the arguments.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// We only mock what we MUST mock: fs (no real files), spawn (no real ffmpeg), worker_threads (no real worker)
// But we DON'T mock metadataService - we want to test real formatting logic

let capturedSpawnArgs: { command: string; args: string[] }[] = [];
// Per-test override for the ffprobe stream (channels, tags, sample rate).
let probeStreamOverride: Record<string, unknown> | null = null;

jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => {
    // Simulate ffmpeg existing in the expected location
    if (path.includes('ffmpeg')) return true;
    // Simulate input file existing
    if (path.includes('input')) return true;
    return false;
  }),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

jest.unstable_mockModule('worker_threads', () => ({
  parentPort: { postMessage: jest.fn() },
  workerData: {},
}));

jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn((command: string, args: string[]) => {
    // CAPTURE the spawn arguments - this is what we're testing!
    capturedSpawnArgs.push({ command, args: [...args] });

    const mockProcess = {
      on: jest.fn((event: string, callback: (code: number) => void) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 0);
        }
        return mockProcess;
      }),
      stderr: {
        on: jest.fn(),
      },
    };
    return mockProcess;
  }),
  // spawnSync is used by metadataService for ffprobe
  spawnSync: jest.fn(() => ({
    stdout: JSON.stringify({
      streams: [
        {
          index: 0,
          codec_name: 'pcm_s16le',
          codec_type: 'audio',
          channels: 2,
          sample_rate: '44100',
          tags: {},
          ...probeStreamOverride,
        },
      ],
      format: {
        filename: 'test.wav',
        format_name: 'wav',
        duration: '180.5',
        size: '1234567',
        bit_rate: '128000',
      },
    }),
    stderr: '',
    status: 0,
    error: null,
  })),
}));

// Mock utils to control platform detection
jest.unstable_mockModule('../utils.js', () => ({
  runtimeBaseDir: '/app',
  isPackagedRuntime: false,
  platformSlug: 'windows',
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error || 'Unknown error'),
  findBinary: () => '/app/ffmpeg.exe',
  addToLog: jest.fn(),
}));

// Import converterWorker (metadataService is NOT mocked - uses real functions)
const { converterWorker } = await import('../converterWorker.js');

describe('ffmpeg argument building - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSpawnArgs = [];
    probeStreamOverride = null;
  });

  describe('basic format conversions', () => {
    it('should build correct args for MP3 conversion', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.wav',
          outputFile: '/output/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      expect(capturedSpawnArgs.length).toBe(1);
      const args = capturedSpawnArgs[0].args;

      // Verify essential MP3 arguments
      expect(args).toContain('-i');
      expect(args).toContain('/input/test.wav');
      expect(args).toContain('-c:a');
      expect(args).toContain('libmp3lame');
      expect(args).toContain('-q:a');
      expect(args).toContain('4');
      expect(args).toContain('/output/test.mp3');
      expect(args).toContain('-vn'); // No video
      expect(args).toContain('-y'); // Overwrite
    });

    it('should build correct args for OGG Vorbis conversion', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.mp3',
          outputFile: '/output/test.ogg',
          outputFormat: 'ogg',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args).toContain('-c:a');
      expect(args).toContain('libvorbis');
      expect(args).toContain('-q:a');
      expect(args).toContain('1.2');
    });

    it('should build correct args for OGG Opus conversion', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.mp3',
          outputFile: '/output/test.ogg',
          outputFormat: 'ogg',
        },
        settings: { oggCodec: 'opus' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args).toContain('-c:a');
      expect(args).toContain('libopus');
      expect(args).toContain('-b:a');
      expect(args).toContain('64k');
    });

    it('should build correct args for WAV conversion', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.mp3',
          outputFile: '/output/test.wav',
          outputFormat: 'wav',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args).toContain('-c:a');
      expect(args).toContain('pcm_s16le');
    });

    it('should build correct args for M4A/AAC conversion', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.wav',
          outputFile: '/output/test.m4a',
          outputFormat: 'm4a',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args).toContain('-c:a');
      expect(args).toContain('aac');
      expect(args).toContain('-b:a');
      expect(args).toContain('256k');
    });

    it('should build correct args for FLAC conversion', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.mp3',
          outputFile: '/output/test.flac',
          outputFormat: 'flac',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args).toContain('-c:a');
      expect(args).toContain('flac');
      expect(args).toContain('-compression_level');
      expect(args).toContain('1');
    });

    it('should build correct args for AIFF conversion', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.mp3',
          outputFile: '/output/test.aiff',
          outputFormat: 'aiff',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args).toContain('-c:a');
      expect(args).toContain('pcm_s16le');
      expect(args).toContain('-write_id3v2');
      expect(args).toContain('1');
    });
  });

  describe('argument ordering', () => {
    it('should put input before output', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.wav',
          outputFile: '/output/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;
      const inputIndex = args.indexOf('/input/test.wav');
      const outputIndex = args.indexOf('/output/test.mp3');

      expect(inputIndex).toBeGreaterThan(-1);
      expect(outputIndex).toBeGreaterThan(-1);
      expect(inputIndex).toBeLessThan(outputIndex);
    });

    it('should have -i flag before input file', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.wav',
          outputFile: '/output/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;
      const iIndex = args.indexOf('-i');
      const inputIndex = args.indexOf('/input/test.wav');

      expect(iIndex + 1).toBe(inputIndex);
    });

    it('should have output file as last argument', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.wav',
          outputFile: '/output/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args[args.length - 1]).toBe('/output/test.mp3');
    });
  });

  describe('metadata preservation', () => {
    it('should strip metadata by default (map_metadata -1)', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.wav',
          outputFile: '/output/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args).toContain('-map_metadata');
      expect(args).toContain('-1');
    });

    it('should rebuild metadata for AIFF like other formats (-map_metadata -1)', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.mp3',
          outputFile: '/output/test.aiff',
          outputFormat: 'aiff',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      // AIFF tags are rebuilt from the probed metadata: copying them through
      // loses OGG/Opus tags, which ffmpeg keeps per stream.
      const mapMetadataIndex = args.indexOf('-map_metadata');
      expect(mapMetadataIndex).not.toBe(-1);
      expect(args[mapMetadataIndex + 1]).toBe('-1');
    });

    it('does not force a channel count for a named stereo layout (no -ac)', async () => {
      probeStreamOverride = { channel_layout: 'stereo' };
      await converterWorker({
        file: {
          inputFile: '/input/test.wav',
          outputFile: '/output/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      expect(capturedSpawnArgs[0].args).not.toContain('-ac');
    });
  });

  describe('file path handling', () => {
    it('should pass input file path without modification', async () => {
      await converterWorker({
        file: {
          inputFile: '/path/with spaces/and (parens)/test.wav',
          outputFile: '/output/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      // Path should be passed as-is (spawn handles quoting)
      expect(args).toContain('/path/with spaces/and (parens)/test.wav');
    });

    it('should pass output file path without modification', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.wav',
          outputFile: '/path/with spaces/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args).toContain('/path/with spaces/test.mp3');
    });

    it('should handle Unicode paths', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/ゲーム音楽/test.wav',
          outputFile: '/output/游戏音乐/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args).toContain('/input/ゲーム音楽/test.wav');
      expect(args).toContain('/output/游戏音乐/test.mp3');
    });
  });

  describe('loop data handling', () => {
    it('should skip loop data when mode is "skip"', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.ogg',
          outputFile: '/output/test.ogg',
          outputFormat: 'ogg',
        },
        settings: { oggCodec: 'vorbis', loopDataMode: 'skip' },
      });

      const args = capturedSpawnArgs[0].args;

      // Should not contain LOOPSTART or loopstart metadata
      expect(args.join(' ')).not.toContain('LOOPSTART');
      expect(args.join(' ')).not.toContain('loopstart');
    });

    it('should skip loop data for WAV format (unsupported)', async () => {
      // Even with loop points in the source, WAV shouldn't get loop metadata
      await converterWorker({
        file: {
          inputFile: '/input/test.ogg', // Assume source has loop points
          outputFile: '/output/test.wav',
          outputFormat: 'wav',
        },
        settings: { oggCodec: 'vorbis', loopDataMode: 'auto' },
      });

      const args = capturedSpawnArgs[0].args;

      // WAV doesn't support loop points in ffmpeg metadata
      expect(args.join(' ')).not.toContain('LOOPSTART');
    });

    it('should skip loop data for M4A format (unsupported)', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.ogg',
          outputFile: '/output/test.m4a',
          outputFormat: 'm4a',
        },
        settings: { oggCodec: 'vorbis', loopDataMode: 'auto' },
      });

      const args = capturedSpawnArgs[0].args;

      // M4A doesn't support loop points
      expect(args.join(' ')).not.toContain('LOOPSTART');
    });
  });

  describe('validation errors', () => {
    it('should reject paths with quotes', async () => {
      await expect(
        converterWorker({
          file: {
            inputFile: '/input/test.wav',
            outputFile: '/output/"test".mp3',
            outputFormat: 'mp3',
          },
          settings: { oggCodec: 'vorbis' },
        })
      ).rejects.toThrow(/quotes/i);
    });

    it('should reject paths with newlines', async () => {
      await expect(
        converterWorker({
          file: {
            inputFile: '/input/test.wav',
            outputFile: '/output/test\ninjection.mp3',
            outputFormat: 'mp3',
          },
          settings: { oggCodec: 'vorbis' },
        })
      ).rejects.toThrow(/line break/i);
    });

    it('should reject missing input file', async () => {
      await expect(
        converterWorker({
          file: {
            inputFile: '',
            outputFile: '/output/test.mp3',
            outputFormat: 'mp3',
          },
          settings: { oggCodec: 'vorbis' },
        })
      ).rejects.toThrow(/input file/i);
    });

    it('should reject missing output file', async () => {
      await expect(
        converterWorker({
          file: {
            inputFile: '/input/test.wav',
            outputFile: '',
            outputFormat: 'mp3',
          },
          settings: { oggCodec: 'vorbis' },
        })
      ).rejects.toThrow(/output file/i);
    });
  });

  describe('loglevel setting', () => {
    it('should always start with -loglevel error', async () => {
      await converterWorker({
        file: {
          inputFile: '/input/test.wav',
          outputFile: '/output/test.mp3',
          outputFormat: 'mp3',
        },
        settings: { oggCodec: 'vorbis' },
      });

      const args = capturedSpawnArgs[0].args;

      expect(args[0]).toBe('-loglevel');
      expect(args[1]).toBe('error');
    });
  });
});

describe('codec selection validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSpawnArgs = [];
  });

  it('should use vorbis codec for ogg when oggCodec=vorbis', async () => {
    await converterWorker({
      file: {
        inputFile: '/input/test.wav',
        outputFile: '/output/test.ogg',
        outputFormat: 'ogg',
      },
      settings: { oggCodec: 'vorbis' },
    });

    const args = capturedSpawnArgs[0].args;
    const codecIndex = args.indexOf('-c:a');

    expect(codecIndex).not.toBe(-1);
    expect(args[codecIndex + 1]).toBe('libvorbis');
  });

  it('should use opus codec for ogg when oggCodec=opus', async () => {
    await converterWorker({
      file: {
        inputFile: '/input/test.wav',
        outputFile: '/output/test.ogg',
        outputFormat: 'ogg',
      },
      settings: { oggCodec: 'opus' },
    });

    const args = capturedSpawnArgs[0].args;
    const codecIndex = args.indexOf('-c:a');

    expect(codecIndex).not.toBe(-1);
    expect(args[codecIndex + 1]).toBe('libopus');
  });
});

describe('source loop tags and channel handling', () => {
  beforeEach(() => {
    capturedSpawnArgs = [];
    probeStreamOverride = null;
  });

  const run = async (
    outputFormat: string,
    settings: Record<string, string>
  ) => {
    await converterWorker({
      file: {
        inputFile: '/input/loop.flac',
        outputFile: `/output/loop.${outputFormat}`,
        outputFormat,
      },
      settings: { oggCodec: 'vorbis', ...settings },
    });
    return capturedSpawnArgs[0].args;
  };

  const metadataValues = (args: string[]) =>
    args.filter((_, i) => args[i - 1] === '-metadata');

  it('does not copy source loop tags when loop mode is "skip"', async () => {
    probeStreamOverride = {
      tags: { title: 'T', LOOPSTART: '22050', LOOPLENGTH: '22050' },
    };
    const values = metadataValues(await run('ogg', { loopDataMode: 'skip' }));
    expect(values).toContain('title=T');
    expect(values.some((v) => /^loop/i.test(v))).toBe(false);
  });

  it('drops unconverted LOOP_START variants when Opus resamples', async () => {
    probeStreamOverride = {
      tags: { LOOP_START: '22050', LOOP_LENGTH: '22050' },
    };
    const values = metadataValues(await run('ogg', { oggCodec: 'opus' }));
    expect(values).toContain('LOOPSTART=24000');
    expect(values).not.toContain('LOOP_START=22050');
    expect(values).not.toContain('LOOP_LENGTH=22050');
  });

  it('drops source loop tags on AIFF in "skip" mode', async () => {
    probeStreamOverride = {
      tags: { LOOPSTART: '22050', LOOPLENGTH: '22050' },
    };
    const args = await run('aiff', { loopDataMode: 'skip' });
    expect(args.join(' ')).toContain('-map_metadata -1');
    expect(metadataValues(args).some((v) => /^loop/i.test(v))).toBe(false);
  });

  it('downmixes surround sources to stereo for MP3', async () => {
    probeStreamOverride = { channels: 6 };
    const args = await run('mp3', {});
    expect(args[args.indexOf('-ac') + 1]).toBe('2');
  });

  it('uses Opus mapping family 255 for 4-channel sources (the default mapping rejects them)', async () => {
    probeStreamOverride = { channels: 4 };
    const args = await run('ogg', { oggCodec: 'opus' });
    expect(args.join(' ')).toContain('-mapping_family 255');
  });

  it('keeps the default Opus mapping for 5.1', async () => {
    probeStreamOverride = { channels: 6 };
    const args = await run('ogg', { oggCodec: 'opus' });
    expect(args).not.toContain('-mapping_family');
  });

  it('keeps surround sources as they are for formats that support them (B45)', async () => {
    // -ac would remix quad, 5.1(side), ... into the default layout.
    probeStreamOverride = { channels: 4, channel_layout: 'quad' };
    for (const fmt of ['flac', 'wav', 'm4a', 'aiff']) {
      const args = await run(fmt, {});
      expect(args).not.toContain('-ac');
      expect(args).not.toContain('-af');
    }
  });

  it.each([undefined, 'unknown', '6 channels'])(
    'labels sources with no named layout (%s) with -ac, which AAC needs',
    async (layout) => {
      probeStreamOverride = { channels: 6, channel_layout: layout };
      const args = await run('m4a', {});
      expect(args[args.indexOf('-ac') + 1]).toBe('6');
      expect(args).not.toContain('-af');
    }
  );

  it.each([
    ['4.0', 4, 'quad'],
    ['2.1', 3, '3.0'],
    ['6.1(back)', 7, '6.1'],
    ['hexagonal', 6, '5.1'],
  ])(
    'remixes %s to the Vorbis layout %s (B42)',
    async (layout, channels, target) => {
      probeStreamOverride = { channels, channel_layout: layout };
      const args = await run('ogg', { oggCodec: 'vorbis' });
      expect(args.join(' ')).toContain(`-af aformat=channel_layouts=${target}`);
    }
  );

  it.each(['quad', '5.1(side)', 'stereo', '6 channels'])(
    'leaves Vorbis-compatible or unnamed layout %s alone',
    async (layout) => {
      probeStreamOverride = { channels: 6, channel_layout: layout };
      const args = await run('ogg', { oggCodec: 'vorbis' });
      expect(args).not.toContain('-af');
    }
  );
});
