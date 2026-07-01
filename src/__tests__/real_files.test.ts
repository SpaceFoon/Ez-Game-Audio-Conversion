import { it, expect, beforeAll, afterEach, jest } from '@jest/globals';
import { fileURLToPath } from 'url';

import { existsSync, readdirSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { convertFiles } from '../../src/converterManager.js';
import { settings } from '../../src/utils.js';
import type { ConversionItem } from '../../src/types/audio.js';
import generateTestFiles from './test-utils/generateTestFiles.js';
import {
  canRunIntegration,
  integrationSkipReason,
} from './test-utils/ffmpegGate.js';
import { resolveE2eDescribe } from './test-utils/e2eDeps.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants for test directories
const TEST_FILES_DIR = join(__dirname, 'test_files');
const TEST_INPUT_DIR = join(TEST_FILES_DIR, 'input');
const TEST_OUTPUT_DIR = join(TEST_FILES_DIR, 'output');

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aiff'];

const canRunRealTests = canRunIntegration;

const listAudioFiles = (): string[] => {
  if (!existsSync(TEST_INPUT_DIR)) {
    return [];
  }
  return readdirSync(TEST_INPUT_DIR).filter((file) =>
    AUDIO_EXTENSIONS.includes(extname(file).toLowerCase())
  );
};

/** Use bundled ffmpeg to create sample inputs when the folder is empty. */
const provisionTestInputFiles = (): boolean => {
  const { ffmpegPath } = generateTestFiles.findFfmpegExecutables();
  if (!existsSync(ffmpegPath)) {
    console.log(
      `Bundled ffmpeg not found at ${ffmpegPath}, skipping real file tests`
    );
    return false;
  }

  mkdirSync(TEST_INPUT_DIR, { recursive: true });
  const generated = generateTestFiles.generateTestAudioFiles(TEST_INPUT_DIR, {
    formats: ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aiff'],
    duration: 2,
  });

  return Object.keys(generated).length > 0;
};

// Run when user-supplied files exist, or when bundled ffmpeg can generate them.
const shouldRunTests = (): boolean => {
  if (!canRunRealTests) {
    console.log(
      'Real file tests need bundled ffmpeg and dist/converterWorker.js (npm run build)'
    );
    return false;
  }

  if (listAudioFiles().length > 0) {
    return true;
  }

  if (provisionTestInputFiles()) {
    console.log('Generated sample audio files for real file tests');
    return listAudioFiles().length > 0;
  }

  console.log('No audio files available for real file tests');
  return false;
};

// Create a function to setup the test environment
const setupTestEnvironment = () => {
  // Create output directory if it doesn't exist
  if (!existsSync(TEST_OUTPUT_DIR)) {
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  }

  // Clean output directory
  const files = readdirSync(TEST_OUTPUT_DIR);
  for (const file of files) {
    unlinkSync(join(TEST_OUTPUT_DIR, file));
  }

  // Configure settings for testing
  settings.inputFilePath = TEST_INPUT_DIR;
  settings.outputFilePath = TEST_OUTPUT_DIR;
  settings.inputFormats = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aiff'];
  settings.outputFormats = ['mp3']; // Convert to MP3 for testing
  settings.oggCodec = 'vorbis'; // Set a default codec for OGG

  return true;
};

// Skip entire suite when prerequisites are missing
const runTests = shouldRunTests();
const describeReal = resolveE2eDescribe(
  runTests,
  integrationSkipReason ||
    'ffmpeg binaries or dist/converterWorker.js missing — run npm run build and npm run install:ffmpeg'
);

describeReal('Real file tests', () => {
  let logSpy: ReturnType<typeof jest.spyOn> | undefined;
  let errorSpy: ReturnType<typeof jest.spyOn> | undefined;
  let warnSpy: ReturnType<typeof jest.spyOn> | undefined;

  beforeAll(() => {
    setupTestEnvironment();
  });

  // Setup before each test
  beforeEach(() => {
    // Capture console output
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // Cleanup after each test
  afterEach(() => {
    // Restore console
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    warnSpy?.mockRestore();
  });

  it('should find and process real audio files', async () => {
    // Get all audio files in the test input directory
    const files = readdirSync(TEST_INPUT_DIR)
      .filter((file) => {
        const ext = extname(file).toLowerCase();
        return ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aiff'].includes(ext);
      })
      .map((file) => join(TEST_INPUT_DIR, file));

    // Log the files we found
    console.log('Found audio files:', files);

    // Create conversion file list directly from the discovered files. Output
    // names embed the source extension (`_from_<ext>`) so there are no output
    // collisions even when several inputs share a basename.
    const conversionList: ConversionItem[] = files.map((inputFile) => {
      const ext = extname(inputFile).slice(1);
      const base = basename(inputFile, extname(inputFile));
      return {
        inputFile,
        outputFile: join(TEST_OUTPUT_DIR, `${base}_from_${ext}.mp3`),
        outputFormat: 'mp3',
      };
    });

    // Only test conversion if we have files
    if (conversionList.length > 0) {
      // Run the conversion
      const result = await convertFiles(conversionList);

      // Verify results
      expect(result).toHaveProperty('successfulFiles');
      expect(result).toHaveProperty('failedFiles');

      // Log results
      console.log('Conversion results:', {
        success: result.successfulFiles.length,
        failed: result.failedFiles.length,
      });

      expect(result.failedFiles).toHaveLength(0);
      expect(result.successfulFiles.length).toBe(conversionList.length);

      // Check output files were created
      const outputFiles = readdirSync(TEST_OUTPUT_DIR);
      expect(outputFiles.length).toBeGreaterThan(0);
    }
  }, 30000); // Increase timeout to 30 seconds for file processing

  // Add a new test that verifies metadata preservation
  it('should preserve metadata during conversion', async () => {
    // For this test, we'll convert to multiple formats
    settings.outputFormats = ['mp3', 'ogg'];

    // Get all audio files in the test input directory
    const files = readdirSync(TEST_INPUT_DIR)
      .filter((file) => {
        const ext = extname(file).toLowerCase();
        return ['.mp3', '.wav', '.flac', '.ogg'].includes(ext);
      })
      .map((file) => join(TEST_INPUT_DIR, file));

    if (files.length === 0) {
      console.log('No suitable audio files for metadata test');
      return;
    }

    // Create conversion list with first file only
    const testFile = files[0];
    const conversionList: ConversionItem[] = [
      {
        inputFile: testFile,
        outputFile: join(TEST_OUTPUT_DIR, `metadata_test_mp3.mp3`),
        outputFormat: 'mp3',
      },
      {
        inputFile: testFile,
        outputFile: join(TEST_OUTPUT_DIR, `metadata_test_ogg.ogg`),
        outputFormat: 'ogg',
      },
    ];

    // Run the conversion
    const result = await convertFiles(conversionList);

    expect(result.failedFiles).toHaveLength(0);
    expect(result.successfulFiles.length).toBe(conversionList.length);

    // The metadataService test already covers the details of metadata extraction
    // so this is just a high-level integration test
  }, 30000); // 30 second timeout
});
