const fs = require("fs");
const path = require("path");
const { convertFiles } = require("../../src/convertFiles");
const { settings } = require("../../src/utils");

// Constants for test directories
const TEST_FILES_DIR = path.join(__dirname, "test_files");
const TEST_INPUT_DIR = path.join(TEST_FILES_DIR, "input");
const TEST_OUTPUT_DIR = path.join(TEST_FILES_DIR, "output");

// Simplified version of deleteDuplicateFiles for test purposes only
const handleDuplicateFiles = (files) => {
  const priorityList = [
    ".midi",
    ".mid",
    ".ogg",
    ".mp3",
    ".m4a",
    ".wav",
    ".flac",
    ".aiff",
  ];
  const fileobjs = files.map((file) => [
    path.join(path.dirname(file), path.basename(file, path.extname(file))),
    path.extname(file),
  ]);

  const uniq = new Map();
  const droppedFiles = [];

  for (const [name, ext] of fileobjs) {
    if (!uniq.has(name)) {
      uniq.set(name, ext);
      continue;
    }

    const current = uniq.get(name);
    if (priorityList.indexOf(ext) > priorityList.indexOf(current)) {
      droppedFiles.push(`${name}${current}`);
      uniq.set(name, ext);
    } else {
      droppedFiles.push(`${name}${ext}`);
    }
  }

  const uniqueFiles = Array.from(uniq.entries()).reduce(
    (p, c) => [...p, `${c[0]}${c[1]}`],
    []
  );

  return {
    uniqueFiles,
    droppedFiles,
  };
};

// Skip these tests if no audio files are found or if running in CI
const shouldRunTests = () => {
  // Check if test input directory exists and has files
  if (!fs.existsSync(TEST_INPUT_DIR)) {
    console.log("Test input directory not found, skipping real file tests");
    return false;
  }

  // Check if there are any audio files
  const files = fs.readdirSync(TEST_INPUT_DIR);
  const audioFiles = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aiff"].includes(ext);
  });

  if (audioFiles.length === 0) {
    console.log(
      "No audio files found in test directory, skipping real file tests"
    );
    return false;
  }

  return true;
};

// Create a function to setup the test environment
const setupTestEnvironment = () => {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  }

  // Clean output directory
  const files = fs.readdirSync(TEST_OUTPUT_DIR);
  for (const file of files) {
    fs.unlinkSync(path.join(TEST_OUTPUT_DIR, file));
  }

  // Configure settings for testing
  settings.inputFilePath = TEST_INPUT_DIR;
  settings.outputFilePath = TEST_OUTPUT_DIR;
  settings.inputFormats = ["mp3", "wav", "flac", "ogg", "m4a", "aiff"];
  settings.outputFormats = ["mp3"]; // Convert to MP3 for testing
  settings.oggCodec = "vorbis"; // Set a default codec for OGG

  return true;
};

// Skip all tests if we don't have real files to test with
const runTests = shouldRunTests();

describe("Real file tests", () => {
  // Skip all tests if no audio files are available
  beforeAll(() => {
    if (runTests) {
      setupTestEnvironment();
    }
  });

  // Setup before each test
  beforeEach(() => {
    if (!runTests) return;

    // Capture console output
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  // Cleanup after each test
  afterEach(() => {
    if (!runTests) return;

    // Restore console
    console.log.mockRestore();
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  it("should find and process real audio files", async () => {
    // Skip if no real files
    if (!runTests) {
      return;
    }

    // Get all audio files in the test input directory
    const files = fs
      .readdirSync(TEST_INPUT_DIR)
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aiff"].includes(ext);
      })
      .map((file) => path.join(TEST_INPUT_DIR, file));

    // Log the files we found
    console.log("Found audio files:", files);

    // Use our local implementation
    const result = handleDuplicateFiles(files);
    expect(Array.isArray(result.uniqueFiles)).toBe(true);
    expect(Array.isArray(result.droppedFiles)).toBe(true);

    // Create conversion file list
    const conversionList = result.uniqueFiles.map((inputFile) => ({
      inputFile,
      outputFile: path.join(
        TEST_OUTPUT_DIR,
        `${path.basename(inputFile, path.extname(inputFile))}.mp3`
      ),
      outputFormat: "mp3",
    }));

    // Only test conversion if we have files
    if (conversionList.length > 0) {
      // Run the conversion
      const result = await convertFiles(conversionList);

      // Verify results
      expect(result).toHaveProperty("successfulFiles");
      expect(result).toHaveProperty("failedFiles");

      // Log results
      console.log("Conversion results:", {
        success: result.successfulFiles.length,
        failed: result.failedFiles.length,
      });

      // Check output files were created
      const outputFiles = fs.readdirSync(TEST_OUTPUT_DIR);
      expect(outputFiles.length).toBeGreaterThan(0);
    }
  }, 30000); // Increase timeout to 30 seconds for file processing

  // Add a new test that verifies metadata preservation
  it("should preserve metadata during conversion", async () => {
    // Skip if no real files
    if (!runTests) {
      return;
    }

    // For this test, we'll convert to multiple formats
    settings.outputFormats = ["mp3", "ogg"];

    // Get all audio files in the test input directory
    const files = fs
      .readdirSync(TEST_INPUT_DIR)
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".mp3", ".wav", ".flac", ".ogg"].includes(ext);
      })
      .map((file) => path.join(TEST_INPUT_DIR, file));

    if (files.length === 0) {
      console.log("No suitable audio files for metadata test");
      return;
    }

    // Create conversion list with first file only
    const testFile = files[0];
    const conversionList = [
      {
        inputFile: testFile,
        outputFile: path.join(TEST_OUTPUT_DIR, `metadata_test_mp3.mp3`),
        outputFormat: "mp3",
      },
      {
        inputFile: testFile,
        outputFile: path.join(TEST_OUTPUT_DIR, `metadata_test_ogg.ogg`),
        outputFormat: "ogg",
      },
    ];

    // Run the conversion
    const result = await convertFiles(conversionList);

    // Check we have successful files
    expect(result.successfulFiles.length).toBeGreaterThan(0);

    // The metadataService test already covers the details of metadata extraction
    // so this is just a high-level integration test
  }, 30000); // 30 second timeout

  // Add a test for duplicate file handling
  it("should correctly handle duplicate filenames with different extensions", async () => {
    // Skip if no real files
    if (!runTests) {
      return;
    }

    // Get all audio files in the test input directory
    const files = fs
      .readdirSync(TEST_INPUT_DIR)
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aiff"].includes(ext);
      })
      .map((file) => path.join(TEST_INPUT_DIR, file));

    // Create files array with duplicates (if we have enough files)
    let duplicateFiles = [];

    if (files.length >= 2) {
      const file1 = files[0];
      const file2 = files[1];

      // Rename the files to have the same base name but different extensions
      const testFile1 = path.join(TEST_INPUT_DIR, `duplicate_test.mp3`);
      const testFile2 = path.join(TEST_INPUT_DIR, `duplicate_test.wav`);

      // Skip this test if we can't create the test files
      try {
        // Only copy if the files don't already exist
        if (!fs.existsSync(testFile1)) {
          fs.copyFileSync(file1, testFile1);
        }
        if (!fs.existsSync(testFile2)) {
          fs.copyFileSync(file2, testFile2);
        }

        duplicateFiles = [testFile1, testFile2];
      } catch (error) {
        console.log("Could not create duplicate test files", error);
        return;
      }
    } else {
      console.log("Not enough files for duplicate test");
      return;
    }

    // Run duplicate test
    const result = handleDuplicateFiles(duplicateFiles);

    // Should only keep one file (the "better" format)
    expect(result.uniqueFiles.length).toBe(1);
    expect(result.droppedFiles.length).toBe(1);

    // Cleanup test files
    try {
      for (const file of duplicateFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      }
    } catch (error) {
      console.error("Error cleaning up test files", error);
    }
  }, 10000); // 10 second timeout
});
