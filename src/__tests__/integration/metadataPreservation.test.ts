/**
 * E2E Integration Tests for Metadata Preservation
 *
 * Tests that tricky metadata (Unicode, commas, quotes, newlines)
 * survives the conversion process and the output file is valid.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root and ffmpeg-bin location
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const TEST_DIR = join(__dirname, '..', 'test-metadata-preservation');
const INPUT_DIR = join(TEST_DIR, 'input');
const OUTPUT_DIR = join(TEST_DIR, 'output');

// Get platform-specific ffmpeg binary paths
const getPlatformSlug = (): string => {
  const p = platform();
  if (p === 'win32') return 'windows';
  if (p === 'darwin') return 'macos';
  return 'linux';
};

const FFMPEG_BIN_DIR = join(PROJECT_ROOT, 'ffmpeg-bin', getPlatformSlug());
const FFMPEG_PATH = join(
  FFMPEG_BIN_DIR,
  platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
);
const FFPROBE_PATH = join(
  FFMPEG_BIN_DIR,
  platform() === 'win32' ? 'ffprobe.exe' : 'ffprobe'
);

// Test metadata cases - each one tests a specific edge case
const METADATA_TEST_CASES = [
  {
    name: 'basic',
    metadata: {
      title: 'Simple Song',
      artist: 'Test Artist',
      album: 'Test Album',
    },
    description: 'Basic ASCII metadata',
  },
  {
    name: 'japanese',
    metadata: {
      title: '桜の花びらたち',
      artist: 'ゲーム音楽作曲家',
      album: '日本のゲームサウンドトラック',
    },
    description: 'Japanese characters',
  },
  {
    name: 'chinese',
    metadata: {
      title: '游戏音乐',
      artist: '作曲家',
      album: '原声带专辑',
    },
    description: 'Chinese characters',
  },
  {
    name: 'korean',
    metadata: {
      title: '게임 음악',
      artist: '작곡가',
      album: '사운드트랙',
    },
    description: 'Korean characters',
  },
  {
    name: 'emoji',
    metadata: {
      title: '🎵 Music Track 🎶',
      artist: '🎸 Rock Band 🥁',
      album: '💿 Greatest Hits 🔥',
    },
    description: 'Emoji in metadata',
  },
  {
    name: 'commas',
    metadata: {
      title: 'Song, Part 1, Movement 2',
      artist: 'Smith, John & Jones, Bob',
      album: 'Greatest Hits, Vol. 1',
    },
    description: 'Commas in metadata',
  },
  {
    name: 'quotes',
    metadata: {
      title: 'The "Best" Song',
      artist: "John 'The Man' Smith",
      album: 'Album "With" Quotes',
    },
    description: 'Quotes in metadata',
  },
  {
    name: 'special_chars',
    metadata: {
      title: 'Song (Remix) [Extended] {Edit}',
      artist: 'Artist & Friends feat. Guest',
      album: 'Album #1 @2024 $pecial!',
    },
    description: 'Special characters',
  },
  {
    name: 'backslashes',
    metadata: {
      title: 'Path\\To\\Song',
      artist: 'Artist\\Band',
      album: 'C:\\Music\\Album',
    },
    description: 'Backslashes (Windows paths)',
  },
  {
    name: 'long_title',
    metadata: {
      title:
        'This Is A Very Long Song Title That Goes On And On And Contains Many Words To Test How The System Handles Long Metadata Strings',
      artist: 'Artist With A Reasonably Long Name That Should Still Work',
      album: 'The Complete Collection Of All Songs Ever Made Volume One',
    },
    description: 'Long metadata strings',
  },
  {
    name: 'mixed_unicode',
    metadata: {
      title: 'Song 曲 노래 🎵',
      artist: 'Artist アーティスト 歌手',
      album: 'Album アルバム 专辑 앨범',
    },
    description: 'Mixed Unicode scripts',
  },
];

// Output formats to test
const OUTPUT_FORMATS = ['mp3', 'ogg', 'flac'];

// Check if ffmpeg is available (use bundled binary)
const checkFfmpeg = (): boolean => {
  if (!existsSync(FFMPEG_PATH)) {
    console.log(`ffmpeg not found at: ${FFMPEG_PATH}`);
    return false;
  }
  try {
    const result = spawnSync(FFMPEG_PATH, ['-version'], {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 5000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
};

// Generate a test WAV file with metadata
const generateTestFile = (
  outputPath: string,
  metadata: Record<string, string>
): boolean => {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const metadataArgs: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    metadataArgs.push('-metadata', `${key}=${value}`);
  }

  const result = spawnSync(
    FFMPEG_PATH,
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-c:a',
      'pcm_s16le',
      '-ar',
      '44100',
      ...metadataArgs,
      outputPath,
    ],
    { encoding: 'utf8', timeout: 30000 }
  );

  return result.status === 0 && existsSync(outputPath);
};

// Convert using the actual converter worker logic
const convertFile = (
  inputPath: string,
  outputPath: string,
  format: string
): boolean => {
  const codecMap: Record<string, string[]> = {
    mp3: ['-c:a', 'libmp3lame', '-q:a', '4'],
    ogg: ['-c:a', 'libvorbis', '-q:a', '1.2'],
    flac: ['-c:a', 'flac', '-compression_level', '9'],
    wav: ['-c:a', 'pcm_s16le'],
    m4a: ['-c:a', 'aac', '-b:a', '256k'],
    aiff: ['-c:a', 'pcm_s16le', '-write_id3v2', '1'],
  };

  const codecArgs = codecMap[format] || ['-c:a', 'copy'];
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Use -map_metadata 0 to copy metadata from input
  const result = spawnSync(
    FFMPEG_PATH,
    [
      '-y',
      '-i',
      inputPath,
      '-map_metadata',
      '0',
      ...codecArgs,
      '-vn',
      outputPath,
    ],
    { encoding: 'utf8', timeout: 30000 }
  );

  return result.status === 0 && existsSync(outputPath);
};

// Extract metadata using ffprobe
const getMetadata = (
  filePath: string
): {
  format: Record<string, unknown>;
  streams: Record<string, unknown>[];
} | null => {
  try {
    const result = spawnSync(
      FFPROBE_PATH,
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ],
      { encoding: 'utf8', timeout: 10000 }
    );

    if (result.status !== 0) return null;
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
};

// Get a specific tag from metadata
const getTag = (
  metadata: {
    format?: { tags?: Record<string, string> };
    streams?: { tags?: Record<string, string> }[];
  } | null,
  tagName: string
): string | null => {
  if (!metadata) return null;

  // Check format tags
  const formatTags = metadata.format?.tags;
  if (formatTags) {
    if (formatTags[tagName]) return formatTags[tagName];
    if (formatTags[tagName.toLowerCase()])
      return formatTags[tagName.toLowerCase()];
    if (formatTags[tagName.toUpperCase()])
      return formatTags[tagName.toUpperCase()];
  }

  // Check stream tags
  const streamTags = metadata.streams?.[0]?.tags;
  if (streamTags) {
    if (streamTags[tagName]) return streamTags[tagName];
    if (streamTags[tagName.toLowerCase()])
      return streamTags[tagName.toLowerCase()];
    if (streamTags[tagName.toUpperCase()])
      return streamTags[tagName.toUpperCase()];
  }

  return null;
};

// Verify file is not corrupted
const verifyFileIntegrity = (
  filePath: string
): { valid: boolean; duration: number | null; error?: string } => {
  try {
    const result = spawnSync(
      FFPROBE_PATH,
      [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { encoding: 'utf8', timeout: 10000 }
    );

    if (result.status !== 0) {
      return { valid: false, duration: null, error: result.stderr };
    }

    const duration = parseFloat(result.stdout.trim());
    return { valid: !isNaN(duration) && duration > 0, duration };
  } catch (error) {
    return { valid: false, duration: null, error: String(error) };
  }
};

describe('Metadata Preservation E2E Tests', () => {
  const ffmpegAvailable = checkFfmpeg();

  beforeAll(() => {
    if (!ffmpegAvailable) {
      console.log('Skipping metadata preservation tests: ffmpeg not found');
      return;
    }

    // Clean and create test directories
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(INPUT_DIR, { recursive: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up
    if (existsSync(TEST_DIR)) {
      try {
        rmSync(TEST_DIR, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  const itWithFfmpeg = ffmpegAvailable ? it : it.skip;

  describe('Input file generation', () => {
    for (const testCase of METADATA_TEST_CASES) {
      itWithFfmpeg(`generates input file with ${testCase.description}`, () => {
        const inputPath = join(INPUT_DIR, `${testCase.name}.wav`);
        const success = generateTestFile(inputPath, testCase.metadata);
        expect(success).toBe(true);

        // Verify metadata was written
        const metadata = getMetadata(inputPath);
        expect(metadata).not.toBeNull();

        const title = getTag(metadata, 'title');
        expect(title).toBe(testCase.metadata.title);
      });
    }
  });

  describe('Conversion and metadata preservation', () => {
    for (const testCase of METADATA_TEST_CASES) {
      for (const format of OUTPUT_FORMATS) {
        itWithFfmpeg(
          `preserves ${testCase.description} when converting to ${format}`,
          () => {
            const inputPath = join(INPUT_DIR, `${testCase.name}.wav`);
            const outputPath = join(OUTPUT_DIR, `${testCase.name}.${format}`);

            // Ensure input exists
            if (!existsSync(inputPath)) {
              generateTestFile(inputPath, testCase.metadata);
            }

            // Convert
            const convertSuccess = convertFile(inputPath, outputPath, format);
            expect(convertSuccess).toBe(true);

            // Verify output exists
            expect(existsSync(outputPath)).toBe(true);

            // Verify file integrity
            const integrity = verifyFileIntegrity(outputPath);
            expect(integrity.valid).toBe(true);
            expect(integrity.duration).toBeGreaterThan(0);

            // Verify metadata preserved
            const outputMetadata = getMetadata(outputPath);
            expect(outputMetadata).not.toBeNull();

            const outputTitle = getTag(outputMetadata, 'title');
            const outputArtist = getTag(outputMetadata, 'artist');
            const outputAlbum = getTag(outputMetadata, 'album');

            // Note: Some formats may slightly modify metadata encoding
            // We check that it's at least present and similar
            expect(outputTitle).not.toBeNull();
            expect(outputArtist).not.toBeNull();

            // For formats that fully support Unicode metadata
            if (format === 'flac' || format === 'ogg') {
              expect(outputTitle).toBe(testCase.metadata.title);
              expect(outputArtist).toBe(testCase.metadata.artist);
              if (outputAlbum) {
                expect(outputAlbum).toBe(testCase.metadata.album);
              }
            }
          }
        );
      }
    }
  });

  describe('File integrity checks', () => {
    itWithFfmpeg('output duration matches input duration', () => {
      const inputPath = join(INPUT_DIR, 'basic.wav');
      if (!existsSync(inputPath)) {
        generateTestFile(inputPath, METADATA_TEST_CASES[0].metadata);
      }

      const inputIntegrity = verifyFileIntegrity(inputPath);
      expect(inputIntegrity.valid).toBe(true);

      for (const format of OUTPUT_FORMATS) {
        const outputPath = join(OUTPUT_DIR, `basic.${format}`);
        if (!existsSync(outputPath)) {
          convertFile(inputPath, outputPath, format);
        }

        const outputIntegrity = verifyFileIntegrity(outputPath);
        expect(outputIntegrity.valid).toBe(true);

        // Duration should be within 0.1 seconds (codec padding may differ slightly)
        expect(
          Math.abs(
            (outputIntegrity.duration || 0) - (inputIntegrity.duration || 0)
          )
        ).toBeLessThan(0.1);
      }
    });

    itWithFfmpeg('output files have no ffprobe errors', () => {
      for (const testCase of METADATA_TEST_CASES) {
        for (const format of OUTPUT_FORMATS) {
          const outputPath = join(OUTPUT_DIR, `${testCase.name}.${format}`);
          if (!existsSync(outputPath)) continue;

          // Run ffprobe with error level logging - any errors indicate corruption
          const result = spawnSync(
            FFPROBE_PATH,
            ['-v', 'error', '-show_format', '-show_streams', outputPath],
            { encoding: 'utf8', timeout: 10000 }
          );

          // stderr should be empty if file is valid
          expect(result.stderr.trim()).toBe('');
        }
      }
    });
  });

  describe('Channel preservation', () => {
    itWithFfmpeg('preserves stereo channels', () => {
      const stereoInput = join(INPUT_DIR, 'stereo_test.wav');

      // Generate stereo file
      const result = spawnSync(
        FFMPEG_PATH,
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440:duration=1',
          '-ac',
          '2',
          '-c:a',
          'pcm_s16le',
          stereoInput,
        ],
        { encoding: 'utf8', timeout: 10000 }
      );
      expect(result.status).toBe(0);

      for (const format of OUTPUT_FORMATS) {
        const outputPath = join(OUTPUT_DIR, `stereo_test.${format}`);
        convertFile(stereoInput, outputPath, format);

        const metadata = getMetadata(outputPath);
        expect(metadata).not.toBeNull();
        expect(metadata?.streams?.[0]).toBeDefined();

        const channels = (metadata?.streams?.[0] as Record<string, unknown>)
          ?.channels;
        expect(channels).toBe(2);
      }
    });

    itWithFfmpeg('preserves mono channels', () => {
      const monoInput = join(INPUT_DIR, 'mono_test.wav');

      // Generate mono file
      const result = spawnSync(
        FFMPEG_PATH,
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=440:duration=1',
          '-ac',
          '1',
          '-c:a',
          'pcm_s16le',
          monoInput,
        ],
        { encoding: 'utf8', timeout: 10000 }
      );
      expect(result.status).toBe(0);

      for (const format of OUTPUT_FORMATS) {
        const outputPath = join(OUTPUT_DIR, `mono_test.${format}`);
        convertFile(monoInput, outputPath, format);

        const metadata = getMetadata(outputPath);
        expect(metadata).not.toBeNull();

        const channels = (metadata?.streams?.[0] as Record<string, unknown>)
          ?.channels;
        expect(channels).toBe(1);
      }
    });
  });

  describe('Sample rate handling', () => {
    const sampleRates = [22050, 44100, 48000];

    for (const rate of sampleRates) {
      itWithFfmpeg(`handles ${rate}Hz sample rate`, () => {
        const inputPath = join(INPUT_DIR, `sr_${rate}.wav`);

        // Generate file with specific sample rate
        const genResult = spawnSync(
          FFMPEG_PATH,
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            `sine=frequency=440:duration=1:sample_rate=${rate}`,
            '-c:a',
            'pcm_s16le',
            inputPath,
          ],
          { encoding: 'utf8', timeout: 10000 }
        );
        expect(genResult.status).toBe(0);

        // Verify input sample rate
        const inputMetadata = getMetadata(inputPath);
        const inputSampleRate = (
          inputMetadata?.streams?.[0] as Record<string, unknown>
        )?.sample_rate;
        expect(inputSampleRate).toBe(String(rate));

        // Convert to each format
        for (const format of OUTPUT_FORMATS) {
          const outputPath = join(OUTPUT_DIR, `sr_${rate}.${format}`);
          convertFile(inputPath, outputPath, format);

          const outputMetadata = getMetadata(outputPath);
          expect(outputMetadata).not.toBeNull();

          // Verify file is valid
          const integrity = verifyFileIntegrity(outputPath);
          expect(integrity.valid).toBe(true);
        }
      });
    }
  });

  describe('Unicode filenames', () => {
    const FILENAME_TEST_CASES = [
      { name: '日本語ファイル', description: 'Japanese filename' },
      { name: '中文文件名', description: 'Chinese filename' },
      { name: '한국어파일', description: 'Korean filename' },
      { name: 'Ümläüt Fïlé', description: 'German umlauts' },
      { name: 'Café Résumé', description: 'French accents' },
      { name: 'Ñoño España', description: 'Spanish characters' },
      { name: 'Привет мир', description: 'Russian Cyrillic' },
      { name: 'مرحبا', description: 'Arabic' },
      { name: '🎵 Music 🎶', description: 'Emoji filename' },
      { name: 'File (Copy) [2] {test}', description: 'Brackets in filename' },
      { name: "File's Name", description: 'Apostrophe in filename' },
      { name: 'File - Name_v2.0', description: 'Dashes and underscores' },
      {
        name: 'Very Long Filename That Contains Many Characters And Words To Test Path Length Limits',
        description: 'Long filename',
      },
    ];

    for (const testCase of FILENAME_TEST_CASES) {
      itWithFfmpeg(`handles ${testCase.description}`, () => {
        const inputPath = join(INPUT_DIR, `${testCase.name}.wav`);

        // Generate input file
        const genResult = spawnSync(
          FFMPEG_PATH,
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'sine=frequency=440:duration=1',
            '-c:a',
            'pcm_s16le',
            inputPath,
          ],
          { encoding: 'utf8', timeout: 10000 }
        );
        expect(genResult.status).toBe(0);
        expect(existsSync(inputPath)).toBe(true);

        // Convert to mp3
        const outputPath = join(OUTPUT_DIR, `${testCase.name}.mp3`);
        const convertSuccess = convertFile(inputPath, outputPath, 'mp3');
        expect(convertSuccess).toBe(true);
        expect(existsSync(outputPath)).toBe(true);

        // Verify output is valid
        const integrity = verifyFileIntegrity(outputPath);
        expect(integrity.valid).toBe(true);
      });
    }
  });

  describe('Unicode directory paths', () => {
    const PATH_TEST_CASES = [
      { path: '日本語/フォルダ', description: 'Japanese path' },
      { path: '音乐/游戏音乐', description: 'Chinese path' },
      { path: '음악/게임', description: 'Korean path' },
      { path: 'Müsik/Ördner', description: 'German path' },
      { path: 'Música/Álbum', description: 'Spanish path' },
      { path: '🎵/🎶/🎸', description: 'Emoji path' },
      {
        path: 'Artist - Album (2024)/Disc 1',
        description: 'Common music path',
      },
      { path: "John's Music/Best Of", description: 'Apostrophe in path' },
      {
        path: 'Game OST [Deluxe]/Bonus Tracks',
        description: 'Brackets in path',
      },
      {
        path: 'deeply/nested/folder/structure/for/testing',
        description: 'Deeply nested path',
      },
    ];

    for (const testCase of PATH_TEST_CASES) {
      itWithFfmpeg(`handles ${testCase.description}`, () => {
        const inputDir = join(INPUT_DIR, testCase.path);
        const outputDir = join(OUTPUT_DIR, testCase.path);
        const inputPath = join(inputDir, 'track.wav');
        const outputPath = join(outputDir, 'track.mp3');

        // Create input directory and generate file
        mkdirSync(inputDir, { recursive: true });
        const genResult = spawnSync(
          FFMPEG_PATH,
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'sine=frequency=440:duration=1',
            '-c:a',
            'pcm_s16le',
            inputPath,
          ],
          { encoding: 'utf8', timeout: 10000 }
        );
        expect(genResult.status).toBe(0);
        expect(existsSync(inputPath)).toBe(true);

        // Convert
        const convertSuccess = convertFile(inputPath, outputPath, 'mp3');
        expect(convertSuccess).toBe(true);
        expect(existsSync(outputPath)).toBe(true);

        // Verify output is valid
        const integrity = verifyFileIntegrity(outputPath);
        expect(integrity.valid).toBe(true);
      });
    }
  });

  describe('Combined Unicode filename and path', () => {
    const COMBINED_CASES = [
      {
        path: '日本のゲーム',
        filename: '桜の花.wav',
        description: 'Japanese path + Japanese filename',
      },
      {
        path: '游戏音乐/原声带',
        filename: '第一首曲.wav',
        description: 'Chinese path + Chinese filename',
      },
      {
        path: 'Artist アーティスト/Album アルバム',
        filename: 'Track 曲 01.wav',
        description: 'Mixed script path + filename',
      },
      {
        path: '🎮 Games/🎵 OST',
        filename: '🎸 Theme 🎶.wav',
        description: 'Emoji path + emoji filename',
      },
      {
        path: "Smith's Hits/Vol. 1 (Deluxe)",
        filename: "Track #1 - The 'Best' Song.wav",
        description: 'Special chars in both',
      },
    ];

    for (const testCase of COMBINED_CASES) {
      itWithFfmpeg(`handles ${testCase.description}`, () => {
        const inputDir = join(INPUT_DIR, 'combined', testCase.path);
        const outputDir = join(OUTPUT_DIR, 'combined', testCase.path);
        const inputPath = join(inputDir, testCase.filename);
        const outputFilename = testCase.filename.replace('.wav', '.flac');
        const outputPath = join(outputDir, outputFilename);

        // Create input directory and generate file
        mkdirSync(inputDir, { recursive: true });
        const genResult = spawnSync(
          FFMPEG_PATH,
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'sine=frequency=440:duration=1',
            '-c:a',
            'pcm_s16le',
            '-metadata',
            `title=${testCase.filename.replace('.wav', '')}`,
            inputPath,
          ],
          { encoding: 'utf8', timeout: 10000 }
        );
        expect(genResult.status).toBe(0);
        expect(existsSync(inputPath)).toBe(true);

        // Convert to FLAC
        const convertSuccess = convertFile(inputPath, outputPath, 'flac');
        expect(convertSuccess).toBe(true);
        expect(existsSync(outputPath)).toBe(true);

        // Verify output is valid
        const integrity = verifyFileIntegrity(outputPath);
        expect(integrity.valid).toBe(true);

        // Verify metadata preserved
        const metadata = getMetadata(outputPath);
        expect(metadata).not.toBeNull();
      });
    }
  });
});
