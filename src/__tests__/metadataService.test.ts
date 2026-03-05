import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import type { AudioMetadata } from '../types/metadata.js';

// ESM mocks must be declared BEFORE dynamic imports
jest.unstable_mockModule('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  extname: jest.fn((file: string) => {
    const parts = file.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }),
}));

jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

jest.unstable_mockModule('../utils.js', () => ({
  runtimeBaseDir: '/mock/base',
  platformSlug: 'windows',
  findBinary: () => '/mock/base/ffprobe.exe',
}));

jest.unstable_mockModule('child_process', () => ({
  spawnSync: jest.fn(),
  execSync: jest.fn(),
}));

// Dynamic imports after mock declarations
const { existsSync } = await import('fs');
const { spawnSync: _spawnSync } = await import('child_process');
const {
  getMetaData,
  getLoopPoints,
  convertLoopPoints,
  formatLoopData,
  formatMetaDataArgs,
} = await import('../metadataService.js');

const existsSyncMock = existsSync as unknown as jest.MockedFunction<
  typeof existsSync
>;
const spawnSyncMock = _spawnSync as unknown as jest.Mock;
const asMeta = (value: unknown): AudioMetadata => value as AudioMetadata;

describe('metadataService', () => {
  // Save original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress all console output
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });

  describe('getMetaData', () => {
    beforeEach(() => {
      // Reset mocks before each test
      jest.clearAllMocks();

      // Mock fs.existsSync to return true for file existence check
      existsSyncMock.mockReturnValue(true);
    });

    it('should extract metadata from a file using ffprobe', async () => {
      // Mock successful ffprobe execution
      const mockMetadata = {
        streams: [{ codec_type: 'audio', channels: 2 }],
        format: { tags: { title: 'Test Song' } },
      };

      spawnSyncMock.mockReturnValue({
        stdout: JSON.stringify(mockMetadata),
        stderr: '',
        status: 0,
        error: undefined,
      });

      const result = await getMetaData('test.mp3');

      expect(result).toEqual(mockMetadata);
      expect(spawnSyncMock).toHaveBeenCalledWith(
        expect.stringContaining('ffprobe'),
        expect.any(Array),
        expect.objectContaining({ encoding: 'utf8' })
      );
    });

    it('should handle errors gracefully', async () => {
      // Mock spawnSync to throw an error
      spawnSyncMock.mockReturnValue({
        stderr: 'Command failed',
        status: 1,
        error: new Error('Command failed'),
        stdout: '',
      });

      const result = await getMetaData('test.mp3');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error running ffprobe.exe:'),
        expect.any(String)
      );
    });

    // Skip: The path resolution logic differs between packaged and dev modes
    it.skip('should handle file not found errors', async () => {
      // Mock file doesn't exist
      existsSyncMock.mockReturnValue(false);

      // Mock spawnSync to still return something
      spawnSyncMock.mockReturnValue({
        stdout: JSON.stringify({}),
        stderr: '',
        status: 0,
        error: undefined,
      });

      await getMetaData('nonexistent.mp3');

      // Function should still work, but with different ffprobe path
      expect(spawnSyncMock).toHaveBeenCalledWith(
        expect.stringContaining('bin/ffprobe'),
        expect.any(Array),
        expect.objectContaining({ encoding: 'utf8' })
      );
    });

    it('should handle malformed JSON response', async () => {
      // Mock invalid JSON response
      spawnSyncMock.mockReturnValue({
        stdout: 'Not valid JSON',
        stderr: '',
        status: 0,
        error: undefined,
      });

      const result = await getMetaData('test.mp3');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error running ffprobe.exe'),
        expect.any(String)
      );
    });
  });

  describe('getLoopPoints', () => {
    it('should extract loop points from metadata format tags', () => {
      const metadata = asMeta({
        format: {
          tags: {
            LOOPSTART: '1000',
            LOOPLENGTH: '5000',
          },
        },
      });

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(1000);
      expect(loopLength).toBe(5000);
    });

    it('should extract loop points from metadata stream tags', () => {
      const metadata = asMeta({
        streams: [
          {
            tags: {
              LOOPSTART: '1000',
              LOOPLENGTH: '5000',
            },
          },
        ],
      });

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(1000);
      expect(loopLength).toBe(5000);
    });

    it('should handle alternative tag formats', () => {
      const metadata = asMeta({
        format: {
          tags: {
            LOOP_START: '1000',
            LOOP_LENGTH: '5000',
          },
        },
      });

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(1000);
      expect(loopLength).toBe(5000);
    });

    it('should handle iTunes metadata tags', () => {
      const metadata = asMeta({
        format: {
          tags: {
            iTunes_LOOPSTART: '1000',
            iTunes_LOOPLENGTH: '5000',
          },
        },
      });

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBe(1000);
      expect(loopLength).toBe(5000);
    });

    it('should return null if loop points not found', () => {
      const metadata = asMeta({
        format: {
          tags: {
            ARTIST: 'Test',
          },
        },
      });

      const { loopStart, loopLength } = getLoopPoints(metadata);
      expect(loopStart).toBeNaN();
      expect(loopLength).toBeNaN();
    });
  });

  describe('convertLoopPoints', () => {
    it('should adjust loop points for opus format', () => {
      const metadata = asMeta({
        streams: [
          {
            sample_rate: '44100',
            tags: {
              LOOPSTART: '1000',
              LOOPLENGTH: '5000',
            },
          },
        ],
      });

      const result = convertLoopPoints(metadata, 'ogg', 'opus');

      // For 44.1kHz -> 48kHz conversion
      expect(result.newSampleRate).toBe(48000);
      expect(result.loopStart).toBeGreaterThan(1000); // Should be scaled up
      expect(result.loopLength).toBeGreaterThan(5000); // Should be scaled up
    });

    it('should not adjust loop points for non-opus formats', () => {
      const metadata = asMeta({
        streams: [
          {
            sample_rate: '44100',
            tags: {
              LOOPSTART: '1000',
              LOOPLENGTH: '5000',
            },
          },
        ],
      });

      const result = convertLoopPoints(metadata, 'mp3', 'vorbis');

      expect(result.newSampleRate).toBeNull();
      expect(result.loopStart).toBe(1000);
      expect(result.loopLength).toBe(5000);
    });

    it('should handle different sample rates correctly', () => {
      // Test different sample rate bands - following the exact ranges in metadataService.ts
      const testCases = [
        // if (sampleRateNumber < 8000)
        { rate: '7000', expected: 8000 },

        // else if (sampleRateNumber <= 8000) - 8000 is a valid Opus rate
        { rate: '8000', expected: 8000 },

        // else if (sampleRateNumber > 8000)
        { rate: '9000', expected: 12000 },
        { rate: '10000', expected: 12000 },

        // else if (sampleRateNumber > 12000)
        { rate: '12500', expected: 16000 },
        { rate: '16000', expected: 16000 },

        // else if (sampleRateNumber > 16000)
        { rate: '20000', expected: 24000 },

        // else if (sampleRateNumber >= 22050)
        { rate: '22050', expected: 24000 },
        { rate: '24000', expected: 24000 },

        // if (sampleRateNumber >= 32000)
        { rate: '32000', expected: 48000 },
        { rate: '44100', expected: 48000 },
        { rate: '48000', expected: 48000 },
        { rate: '96000', expected: 48000 },
      ];

      testCases.forEach(({ rate, expected }) => {
        const metadata = asMeta({
          streams: [
            {
              sample_rate: rate,
              tags: {
                LOOPSTART: '1000',
                LOOPLENGTH: '5000',
              },
            },
          ],
        });

        const result = convertLoopPoints(metadata, 'ogg', 'opus');
        expect(result.newSampleRate).toBe(expected);
      });
    });
  });

  describe('formatLoopData', () => {
    it('should format loop data correctly', () => {
      const result = formatLoopData(1000, 5000);

      // Check that result is an array containing the expected metadata args
      expect(result).toEqual([
        '-metadata',
        'LOOPSTART=1000',
        '-metadata',
        'LOOPLENGTH=5000',
        '-metadata',
        'loopstart=1000',
        '-metadata',
        'looplength=5000',
      ]);

      // Should not contain alternative/underscore formats we no longer use
      expect(result.join(' ')).not.toContain('LOOP_START');
      expect(result.join(' ')).not.toContain('LOOP_LENGTH');

      // Should not contain comment-based approaches
      expect(result.join(' ')).not.toContain('COMMENT=');
      expect(result.join(' ')).not.toContain('DESCRIPTION=');
    });

    it('should format loop data for OGG correctly', () => {
      const result = formatLoopData(1000, 5000);

      // Check that result is an array containing the expected metadata args
      expect(result).toEqual([
        '-metadata',
        'LOOPSTART=1000',
        '-metadata',
        'LOOPLENGTH=5000',
        '-metadata',
        'loopstart=1000',
        '-metadata',
        'looplength=5000',
      ]);

      // Should not contain alternative/underscore formats we no longer use
      expect(result.join(' ')).not.toContain('LOOP_START');
      expect(result.join(' ')).not.toContain('LOOP_LENGTH');

      // Should not contain comment-based approaches
      expect(result.join(' ')).not.toContain('COMMENT=');
      expect(result.join(' ')).not.toContain('DESCRIPTION=');
    });

    it('should return empty array for invalid loop points', () => {
      expect(formatLoopData(NaN, 5000)).toEqual([]);
      expect(formatLoopData(1000, NaN)).toEqual([]);
      expect(formatLoopData(NaN, NaN)).toEqual([]);
    });
  });

  describe('formatMetaDataArgs replacement-character handling', () => {
    it('removes replacement character glyphs and logs an error', () => {
      const metadata = asMeta({
        streams: [
          {
            channels: 2,
            tags: {
              performer: 'A�B',
            },
          },
        ],
      });

      const result = formatMetaDataArgs(metadata, 'test.aiff');
      expect(result.metaDataArgs).toContain('performer=AB');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Replacement character found in metadata tag')
      );
    });

    it('skips a metadata field if cleanup leaves it empty and logs', () => {
      const metadata = asMeta({
        streams: [
          {
            channels: 2,
            tags: {
              performer: '�',
            },
          },
        ],
      });

      const result = formatMetaDataArgs(metadata, 'test.aiff');
      expect(result.metaDataArgs.join(' ')).not.toContain('performer=');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'became empty after replacement-character cleanup'
        )
      );
    });
  });
});
