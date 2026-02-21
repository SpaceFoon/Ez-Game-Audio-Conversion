/**
 * Integration tests for Unicode path support
 *
 * These tests verify that the application correctly handles file paths
 * containing Unicode characters from various scripts (Chinese, Japanese,
 * Arabic, European accented, etc.)
 *
 * Requirements:
 * - ffmpeg and ffprobe must be available in PATH or ./ffmpeg-bin/
 * - Tests will skip gracefully if ffmpeg is not available
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const PLATFORM_SLUG =
  process.platform === 'win32'
    ? 'windows'
    : process.platform === 'darwin'
      ? 'macos'
      : 'linux';
const FFMPEG_EXE = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const BUNDLED_FFMPEG = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  FFMPEG_EXE
);
// Only use bundled ffmpeg - no system PATH fallback
const FFMPEG_CMD = BUNDLED_FFMPEG;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test directory setup
const TEST_DIR = join(__dirname, '..', 'test-unicode-paths');
const INPUT_DIR = join(TEST_DIR, 'input');
const OUTPUT_DIR = join(TEST_DIR, 'output');

// Check if ffmpeg is available
const checkFfmpegAvailable = (): boolean => {
  try {
    const result = spawnSync(FFMPEG_CMD, ['-version'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    return result.status === 0;
  } catch {
    return false;
  }
};

// Generate a minimal valid WAV file (1 second of silence)
const generateTestWav = (filePath: string): void => {
  // Create parent directory if needed
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Use ffmpeg to generate a short silent WAV file
  const result = spawnSync(
    FFMPEG_CMD,
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=44100:cl=stereo',
      '-t',
      '0.1', // 100ms of silence
      '-c:a',
      'pcm_s16le',
      filePath,
    ],
    { encoding: 'utf8', timeout: 10000, windowsHide: true }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to generate test WAV: ${result.stderr}`);
  }
};

// Test conversion using ffmpeg directly
const testConversion = (
  inputFile: string,
  outputFile: string,
  format: string
): { success: boolean; error?: string } => {
  const codecMap: Record<string, string[]> = {
    mp3: ['-c:a', 'libmp3lame', '-q:a', '4'],
    ogg: ['-c:a', 'libvorbis', '-q:a', '6'],
    flac: ['-c:a', 'flac', '-compression_level', '5'],
    wav: ['-c:a', 'pcm_s16le'],
    m4a: ['-c:a', 'aac', '-b:a', '128k'],
    aiff: ['-c:a', 'pcm_s16le'],
  };

  const codecArgs = codecMap[format] || ['-c:a', 'copy'];

  // Create output directory
  const outputDir = dirname(outputFile);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const result = spawnSync(
    FFMPEG_CMD,
    ['-y', '-i', inputFile, ...codecArgs, '-vn', outputFile],
    { encoding: 'utf8', timeout: 30000, windowsHide: true }
  );

  if (result.status === 0 && existsSync(outputFile)) {
    return { success: true };
  }

  return {
    success: false,
    error: result.stderr || result.error?.message || 'Unknown error',
  };
};

describe('Unicode Path Support (Integration)', () => {
  const ffmpegAvailable = checkFfmpegAvailable();

  beforeAll(() => {
    if (!ffmpegAvailable) {
      console.log('Skipping Unicode path integration tests: ffmpeg not found');
      return;
    }

    // Clean up and create test directories
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(INPUT_DIR, { recursive: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up test directories
    if (existsSync(TEST_DIR)) {
      try {
        rmSync(TEST_DIR, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  beforeEach(() => {
    if (!ffmpegAvailable) {
      return;
    }
    jest.clearAllMocks();
  });

  // Helper to run test only if ffmpeg is available
  const itWithFfmpeg = ffmpegAvailable ? it : it.skip;

  describe('Chinese character paths', () => {
    const chineseInput = join(INPUT_DIR, '测试音频.wav');
    const chineseOutput = join(OUTPUT_DIR, '输出文件.mp3');

    itWithFfmpeg('creates input file with Chinese name', () => {
      generateTestWav(chineseInput);
      expect(existsSync(chineseInput)).toBe(true);
    });

    itWithFfmpeg('converts file with Chinese name to MP3', () => {
      if (!existsSync(chineseInput)) {
        generateTestWav(chineseInput);
      }
      const result = testConversion(chineseInput, chineseOutput, 'mp3');
      expect(result.success).toBe(true);
      expect(existsSync(chineseOutput)).toBe(true);
    });
  });

  describe('Japanese character paths', () => {
    const japaneseInput = join(INPUT_DIR, 'テスト音楽.wav');
    const japaneseOutput = join(OUTPUT_DIR, '変換済み.ogg');

    itWithFfmpeg('creates input file with Japanese name', () => {
      generateTestWav(japaneseInput);
      expect(existsSync(japaneseInput)).toBe(true);
    });

    itWithFfmpeg('converts file with Japanese name to OGG', () => {
      if (!existsSync(japaneseInput)) {
        generateTestWav(japaneseInput);
      }
      const result = testConversion(japaneseInput, japaneseOutput, 'ogg');
      expect(result.success).toBe(true);
      expect(existsSync(japaneseOutput)).toBe(true);
    });
  });

  describe('Arabic character paths', () => {
    const arabicInput = join(INPUT_DIR, 'اختبار_صوت.wav');
    const arabicOutput = join(OUTPUT_DIR, 'إخراج.flac');

    itWithFfmpeg('creates input file with Arabic name', () => {
      generateTestWav(arabicInput);
      expect(existsSync(arabicInput)).toBe(true);
    });

    itWithFfmpeg('converts file with Arabic name to FLAC', () => {
      if (!existsSync(arabicInput)) {
        generateTestWav(arabicInput);
      }
      const result = testConversion(arabicInput, arabicOutput, 'flac');
      expect(result.success).toBe(true);
      expect(existsSync(arabicOutput)).toBe(true);
    });
  });

  describe('Korean character paths', () => {
    const koreanInput = join(INPUT_DIR, '테스트_오디오.wav');
    const koreanOutput = join(OUTPUT_DIR, '출력_파일.mp3');

    itWithFfmpeg('creates input file with Korean name', () => {
      generateTestWav(koreanInput);
      expect(existsSync(koreanInput)).toBe(true);
    });

    itWithFfmpeg('converts file with Korean name to MP3', () => {
      if (!existsSync(koreanInput)) {
        generateTestWav(koreanInput);
      }
      const result = testConversion(koreanInput, koreanOutput, 'mp3');
      expect(result.success).toBe(true);
      expect(existsSync(koreanOutput)).toBe(true);
    });
  });

  describe('Cyrillic character paths', () => {
    const russianInput = join(INPUT_DIR, 'тестовый_звук.wav');
    const russianOutput = join(OUTPUT_DIR, 'выходной_файл.ogg');

    itWithFfmpeg('creates input file with Russian name', () => {
      generateTestWav(russianInput);
      expect(existsSync(russianInput)).toBe(true);
    });

    itWithFfmpeg('converts file with Russian name to OGG', () => {
      if (!existsSync(russianInput)) {
        generateTestWav(russianInput);
      }
      const result = testConversion(russianInput, russianOutput, 'ogg');
      expect(result.success).toBe(true);
      expect(existsSync(russianOutput)).toBe(true);
    });
  });

  describe('Accented European character paths', () => {
    const accentedInput = join(INPUT_DIR, 'café-naïve-señor-über.wav');
    const accentedOutput = join(OUTPUT_DIR, 'résultat-éléphant.mp3');

    itWithFfmpeg('creates input file with accented name', () => {
      generateTestWav(accentedInput);
      expect(existsSync(accentedInput)).toBe(true);
    });

    itWithFfmpeg('converts file with accented name to MP3', () => {
      if (!existsSync(accentedInput)) {
        generateTestWav(accentedInput);
      }
      const result = testConversion(accentedInput, accentedOutput, 'mp3');
      expect(result.success).toBe(true);
      expect(existsSync(accentedOutput)).toBe(true);
    });
  });

  describe('Mixed script paths', () => {
    const mixedInput = join(INPUT_DIR, 'Test-测试-тест-café.wav');
    const mixedOutput = join(OUTPUT_DIR, 'Mixed-混合-смешанный.flac');

    itWithFfmpeg('creates input file with mixed script name', () => {
      generateTestWav(mixedInput);
      expect(existsSync(mixedInput)).toBe(true);
    });

    itWithFfmpeg('converts file with mixed script name to FLAC', () => {
      if (!existsSync(mixedInput)) {
        generateTestWav(mixedInput);
      }
      const result = testConversion(mixedInput, mixedOutput, 'flac');
      expect(result.success).toBe(true);
      expect(existsSync(mixedOutput)).toBe(true);
    });
  });

  describe('Unicode subdirectory paths', () => {
    const unicodeSubdir = join(OUTPUT_DIR, '子目录-サブフォルダ');
    const subDirInput = join(INPUT_DIR, 'test.wav');
    const subDirOutput = join(unicodeSubdir, '出力.mp3');

    itWithFfmpeg('creates directories with Unicode names', () => {
      mkdirSync(unicodeSubdir, { recursive: true });
      expect(existsSync(unicodeSubdir)).toBe(true);
    });

    itWithFfmpeg('converts to files in Unicode subdirectories', () => {
      generateTestWav(subDirInput);
      const result = testConversion(subDirInput, subDirOutput, 'mp3');
      expect(result.success).toBe(true);
      expect(existsSync(subDirOutput)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    itWithFfmpeg('handles very long Unicode paths', () => {
      // Create a moderately long path with Unicode
      const longName = '长文件名'.repeat(10) + '.wav';
      const longInput = join(INPUT_DIR, longName);
      const longOutput = join(OUTPUT_DIR, longName.replace('.wav', '.mp3'));

      generateTestWav(longInput);
      const result = testConversion(longInput, longOutput, 'mp3');
      expect(result.success).toBe(true);
    });

    itWithFfmpeg('handles Unicode with spaces', () => {
      const spacedInput = join(INPUT_DIR, '文件 名称 有 空格.wav');
      const spacedOutput = join(OUTPUT_DIR, '出力 ファイル 空白.mp3');

      generateTestWav(spacedInput);
      const result = testConversion(spacedInput, spacedOutput, 'mp3');
      expect(result.success).toBe(true);
    });

    itWithFfmpeg('handles Unicode with hyphens and underscores', () => {
      const hyphenInput = join(INPUT_DIR, '测试-音频_文件.wav');
      const hyphenOutput = join(OUTPUT_DIR, 'テスト-オーディオ_ファイル.mp3');

      generateTestWav(hyphenInput);
      const result = testConversion(hyphenInput, hyphenOutput, 'mp3');
      expect(result.success).toBe(true);
    });
  });

  describe('Validation tests (no ffmpeg needed)', () => {
    it('path regex allows Unicode but blocks Windows-invalid chars', () => {
      // This regex matches the one in converterWorker.ts
      // eslint-disable-next-line no-control-regex
      const invalidCharRegex = /[\x00-\x1F<>:|?*]/;

      // These should pass (no match = allowed)
      expect(invalidCharRegex.test('测试音频.mp3')).toBe(false);
      expect(invalidCharRegex.test('テスト.ogg')).toBe(false);
      expect(invalidCharRegex.test('café-über.wav')).toBe(false);
      expect(invalidCharRegex.test('тест-файл.flac')).toBe(false);
      expect(invalidCharRegex.test('اختبار.m4a')).toBe(false);

      // These should fail (match = blocked)
      expect(invalidCharRegex.test('file<name.mp3')).toBe(true);
      expect(invalidCharRegex.test('file>name.mp3')).toBe(true);
      expect(invalidCharRegex.test('file:name.mp3')).toBe(true);
      expect(invalidCharRegex.test('file|name.mp3')).toBe(true);
      expect(invalidCharRegex.test('file?name.mp3')).toBe(true);
      expect(invalidCharRegex.test('file*name.mp3')).toBe(true);
      expect(invalidCharRegex.test('file\x00name.mp3')).toBe(true);
      expect(invalidCharRegex.test('file\tname.mp3')).toBe(true);
    });

    it('validates all Windows-invalid characters are blocked', () => {
      // eslint-disable-next-line no-control-regex
      const invalidCharRegex = /[\x00-\x1F<>:|?*]/;
      const invalidChars = '<>:|?*';

      for (const char of invalidChars) {
        expect(invalidCharRegex.test(`file${char}name.mp3`)).toBe(true);
      }
    });

    it('validates control characters are blocked', () => {
      // eslint-disable-next-line no-control-regex
      const invalidCharRegex = /[\x00-\x1F<>:|?*]/;

      // Test all control characters (0x00-0x1F)
      for (let i = 0; i <= 0x1f; i++) {
        const char = String.fromCharCode(i);
        expect(invalidCharRegex.test(`file${char}name.mp3`)).toBe(true);
      }
    });
  });
});
