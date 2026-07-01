import { expect, it, beforeAll } from '@jest/globals';
import { resolveE2eDescribe } from '../test-utils/e2eDeps.js';

import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { execSync, spawnSync } from 'child_process';
import { platform } from 'os';

const PLATFORM_SLUG =
  platform() === 'win32'
    ? 'windows'
    : platform() === 'darwin'
      ? 'macos'
      : 'linux';
const FFMPEG_EXE = platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const FFPROBE_EXE = platform() === 'win32' ? 'ffprobe.exe' : 'ffprobe';
const FFMPEG_PATH = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  FFMPEG_EXE
);
const FFPROBE_PATH = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  FFPROBE_EXE
);
const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

// Constants
const TEST_DIR = join(
  process.cwd(),
  'src/__tests__',
  'test-assets',
  'format-loop-test'
);
const INPUT_DIR = join(TEST_DIR, 'input');
const OUTPUT_DIR = join(TEST_DIR, 'output');

// Test parameters
const SAMPLE_RATE = 44100;
const DURATION = 2; // seconds
const LOOP_START = 22050; // 0.5 seconds into file (in samples)
const LOOP_LENGTH = 66150; // 1.5 seconds of loop (in samples)

// Format configurations - Using EXACT settings from converterWorker.js
const FORMATS = [
  { name: 'wav', extension: 'wav', codec: 'pcm_s16le', quality: [] },
  {
    name: 'mp3',
    extension: 'mp3',
    codec: 'libmp3lame',
    quality: ['-q:a', '4'],
  },
  {
    name: 'ogg_vorbis',
    extension: 'ogg',
    codec: 'libvorbis',
    quality: ['-q:a', '1.2'],
  },
  {
    name: 'ogg_opus',
    extension: 'ogg',
    codec: 'libopus',
    quality: ['-b:a', '64k'],
  },
  {
    name: 'flac',
    extension: 'flac',
    codec: 'flac',
    quality: ['-compression_level', '9'],
  },
  {
    name: 'aiff',
    extension: 'aiff',
    codec: 'pcm_s16le',
    quality: ['-write_id3v2', '1'],
  },
  { name: 'm4a', extension: 'm4a', codec: 'aac', quality: ['-q:a', '1.4'] },
];

/** WAV/M4A do not round-trip loop tags through ffmpeg the way game formats do. */
const LOOP_ROUNDTRIP_FORMATS = FORMATS.filter(
  (format) => format.name !== 'wav' && format.name !== 'm4a'
);

// Different approaches to store loop points
const METADATA_APPROACHES = [
  {
    name: 'standard_tags',
    description: 'Standard loop tags (LOOPSTART/LOOPLENGTH)',
    generator: (start, length) => [
      `-metadata`,
      `LOOPSTART=${start}`,
      `-metadata`,
      `loopstart=${start}`,
      `-metadata`,
      `LOOPLENGTH=${length}`,
      `-metadata`,
      `looplength=${length}`,
    ],
  },
  {
    name: 'alternative_tags',
    description: 'Alternative loop tags (LOOP_START/LOOP_LENGTH)',
    generator: (start, length) => [
      `-metadata`,
      `LOOP_START=${start}`,
      `-metadata`,
      `LOOP_LENGTH=${length}`,
    ],
  },
];

// Create test directories
function createDirectories() {
  console.log('Creating test directories...');

  // Create directories if they don't exist
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }

  if (!existsSync(INPUT_DIR)) {
    mkdirSync(INPUT_DIR);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR);
  } else {
    // Clean output directory if it exists, but don't fail if we can't clean some files
    try {
      const files = readdirSync(OUTPUT_DIR);
      for (const file of files) {
        try {
          unlinkSync(join(OUTPUT_DIR, file));
        } catch (error) {
          console.log(`Warning: Couldn't remove ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`Warning: Couldn't clean output directory: ${error.message}`);
    }
  }
}

// Check for bundled ffmpeg executable
function checkForFfmpeg() {
  console.log('Checking for ffmpeg...');
  if (!existsSync(FFMPEG_PATH)) {
    console.error(`❌ ffmpeg not found at ${FFMPEG_PATH}`);
    return false;
  }
  try {
    const result = spawnSync(FFMPEG_PATH, ['-version'], {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 5000,
    });
    if (result.status === 0) {
      console.log('✅ ffmpeg found');
      return true;
    }
  } catch {
    // fall through
  }
  console.error('❌ ffmpeg not found. Place binaries in ffmpeg-bin/');
  return false;
}

// Generate test files
function generateTestFiles() {
  console.log('Generating base test audio file...');
  const baseWavPath = join(INPUT_DIR, 'base-sine.wav');

  // Generate a sine wave base file with no metadata
  const baseCmd = [
    quote(FFMPEG_PATH),
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=440:duration=${DURATION}`,
    '-c:a',
    'pcm_s16le',
    '-ar',
    String(SAMPLE_RATE),
    quote(baseWavPath),
  ];

  try {
    execSync(baseCmd.join(' '), { stdio: 'inherit' });
    console.log(`✅ Generated base file: ${baseWavPath}`);
    return baseWavPath;
  } catch (error) {
    console.error('❌ Failed to generate base file:', error);
    return null;
  }
}

// Extract metadata using ffprobe
function getMetadata(filePath: string) {
  try {
    const output = execSync(
      `${quote(FFPROBE_PATH)} -v quiet -print_format json -show_format -show_streams ${quote(filePath)}`,
      { encoding: 'utf8' }
    );

    return JSON.parse(output);
  } catch (error) {
    console.error(`❌ Failed to extract metadata from ${filePath}:`, error);
    return null;
  }
}

// Extract loop points from metadata using all possible methods
function extractLoopPoints(metadata) {
  const results = {
    loopStart: null,
    loopLength: null,
    detectedMethods: [],
  };

  if (!metadata) return results;

  // Helper to try extracting from tags
  const tryExtractFrom = (tags, prefix = '') => {
    if (!tags) return false;

    let foundSomething = false;

    // Try direct tag variants
    if (
      tags.LOOPSTART !== undefined ||
      tags.loopstart !== undefined ||
      tags.LOOP_START !== undefined
    ) {
      results.loopStart = parseInt(
        tags.LOOPSTART || tags.loopstart || tags.LOOP_START
      );
      results.detectedMethods.push(`${prefix}standard_tags`);
      foundSomething = true;
    }

    if (
      tags.LOOPLENGTH !== undefined ||
      tags.looplength !== undefined ||
      tags.LOOP_LENGTH !== undefined
    ) {
      results.loopLength = parseInt(
        tags.LOOPLENGTH || tags.looplength || tags.LOOP_LENGTH
      );
      if (!results.detectedMethods.includes(`${prefix}standard_tags`)) {
        results.detectedMethods.push(`${prefix}standard_tags`);
      }
      foundSomething = true;
    }

    return foundSomething;
  };

  // Check format.tags
  if (metadata.format && metadata.format.tags) {
    tryExtractFrom(metadata.format.tags, 'format_');
  }

  // Check streams[0].tags
  if (metadata.streams && metadata.streams[0] && metadata.streams[0].tags) {
    tryExtractFrom(metadata.streams[0].tags, 'stream_');
  }

  return results;
}

// Run tests with all format and metadata combinations
function runTests(baseFilePath: string, formatFilter?: string) {
  console.log('\nRunning tests for all format and metadata combinations...');
  const results = [];

  // For each format
  for (const format of FORMATS) {
    if (formatFilter && format.name !== formatFilter) {
      continue;
    }
    console.log(`\n=== Testing ${format.name} format ===`);

    // For each metadata approach
    for (const approach of METADATA_APPROACHES) {
      const outputFileName = `${format.name}_${approach.name}.${format.extension}`;
      const outputFilePath = join(OUTPUT_DIR, outputFileName);

      console.log(`\nTesting ${format.name} with ${approach.description}...`);

      try {
        // Generate metadata flags
        const metadataFlags = approach.generator(LOOP_START, LOOP_LENGTH);

        // Build ffmpeg command
        const cmd = [
          quote(FFMPEG_PATH),
          '-y',
          '-i',
          quote(baseFilePath),
          '-c:a',
          format.codec,
          ...format.quality,
          ...metadataFlags,
          quote(outputFilePath),
        ];

        // Execute ffmpeg
        execSync(cmd.join(' '), { stdio: 'pipe' });

        // Check if file was created
        if (existsSync(outputFilePath)) {
          // Extract metadata
          console.log(`Reading metadata from ${basename(outputFilePath)}...`);
          const metadata = getMetadata(outputFilePath);

          if (metadata) {
            // Extract loop points
            const loopPoints = extractLoopPoints(metadata);

            // Validate results
            const success =
              loopPoints.loopStart === LOOP_START &&
              loopPoints.loopLength === LOOP_LENGTH;

            results.push({
              format: format.name,
              approach: approach.name,
              success,
              expected: { start: LOOP_START, length: LOOP_LENGTH },
              actual: {
                start: loopPoints.loopStart,
                length: loopPoints.loopLength,
              },
              detectedMethods: loopPoints.detectedMethods,
            });

            if (success) {
              console.log(
                `✅ Loop points preserved correctly in ${format.name} using ${approach.name}`
              );
              console.log(
                `   Detected methods: ${loopPoints.detectedMethods.join(', ')}`
              );
            } else {
              console.log(
                `❌ Loop points not preserved in ${format.name} using ${approach.name}`
              );
              console.log(
                `   Expected: Start=${LOOP_START}, Length=${LOOP_LENGTH}`
              );
              console.log(
                `   Actual: Start=${loopPoints.loopStart}, Length=${loopPoints.loopLength}`
              );
              if (loopPoints.detectedMethods.length > 0) {
                console.log(
                  `   Detected methods: ${loopPoints.detectedMethods.join(
                    ', '
                  )}`
                );
              } else {
                console.log(`   No metadata methods detected`);
              }
            }
          } else {
            console.log(
              `❌ Failed to extract metadata from ${format.name} file`
            );
            results.push({
              format: format.name,
              approach: approach.name,
              success: false,
              error: 'Failed to extract metadata',
            });
          }
        } else {
          console.log(`❌ Failed to create ${format.name} file`);
          results.push({
            format: format.name,
            approach: approach.name,
            success: false,
            error: 'File creation failed',
          });
        }
      } catch (error) {
        console.error(
          `❌ Error processing ${format.name} with ${approach.name}:`,
          error.message
        );
        results.push({
          format: format.name,
          approach: approach.name,
          success: false,
          error: error.message,
        });
      }
    }
  }

  return results;
}

const ffmpegAvailable =
  existsSync(FFMPEG_PATH) &&
  spawnSync(FFMPEG_PATH, ['-version'], {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 5000,
  }).status === 0;

const describeWithFfmpeg = resolveE2eDescribe(
  ffmpegAvailable,
  `ffmpeg not found at ${FFMPEG_PATH}`
);

let sharedBaseFilePath: string | null = null;

const LOOP_WRITE_UNSUPPORTED = new Set(['wav', 'm4a']);

describeWithFfmpeg('Loop Point Handling Integration', () => {
  beforeAll(() => {
    createDirectories();
    if (!checkForFfmpeg()) {
      throw new Error(`ffmpeg not available at ${FFMPEG_PATH}`);
    }
    sharedBaseFilePath = generateTestFiles();
    if (!sharedBaseFilePath) {
      throw new Error('Failed to generate base loop test audio file');
    }
  });

  for (const format of LOOP_ROUNDTRIP_FORMATS) {
    it(`preserves loop points for ${format.name} (${format.codec})`, () => {
      const results = runTests(sharedBaseFilePath!, format.name);
      if (LOOP_WRITE_UNSUPPORTED.has(format.name)) {
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((entry) => !entry.success)).toBe(true);
        return;
      }

      const failures = results.filter((entry) => !entry.success);
      if (failures.length > 0) {
        const detail = failures
          .map(
            (entry) =>
              `${entry.approach}: expected start=${LOOP_START} length=${LOOP_LENGTH}, actual start=${entry.actual?.start} length=${entry.actual?.length}${entry.error ? ` (${entry.error})` : ''}`
          )
          .join('; ');
        throw new Error(`${format.name} loop failures: ${detail}`);
      }
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((entry) => entry.success)).toBe(true);
    }, 120000);
  }
});
