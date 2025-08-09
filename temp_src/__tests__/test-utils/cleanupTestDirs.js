/**
 * Test Utilities - Cleanup Test Directories
 *
 * This script allows cleaning up test directories to free disk space
 * after tests have been run. It can be run manually or on a schedule.
 */

const fs = require("fs");
const path = require("path");

// Add directories to clean up here
const TEST_DIRECTORIES = [
  path.join(__dirname, "..", "test-assets"),
  path.join(process.cwd(), "format-test"),
  path.join(process.cwd(), "loop-test"),
  path.join(process.cwd(), "test-audio"),
  path.join(process.cwd(), "tag-test"),
  path.join(process.cwd(), "direct-test"),
  path.join(process.cwd(), "test-samplerates"),
  path.join(process.cwd(), "final-test"),
];

/**
 * Safely delete a file, handling permissions errors
 */
function safeDeleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    console.warn(
      `Warning: Could not delete file ${filePath}: ${error.message}`
    );
    return false;
  }
}

/**
 * Clean up test directories by removing all files
 */
function cleanupTestDirectories(directories) {
  for (const dir of directories) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          safeDeleteFile(path.join(dir, file));
        }
      } catch (error) {
        console.warn(
          `Warning: Could not clean directory ${dir}: ${error.message}`
        );
      }
    }
  }
}

/**
 * Recursively delete a directory and its contents
 * @param {string} dirPath - Directory to delete
 * @returns {boolean} - Success status
 */
function cleanupDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory does not exist: ${dirPath}`);
    return true;
  }

  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      console.log(`Not a directory: ${dirPath}`);
      return false;
    }

    console.log(`Cleaning up directory: ${dirPath}`);
    fs.rmSync(dirPath, { recursive: true, force: true });

    // If directory should remain, recreate it empty
    fs.mkdirSync(dirPath, { recursive: true });

    return true;
  } catch (error) {
    console.error(`Error cleaning up directory ${dirPath}:`, error.message);
    return false;
  }
}

/**
 * Clean up all test directories
 * @returns {number} - Number of directories successfully cleaned
 */
function cleanupAllDirectories() {
  console.log("Starting test directory cleanup...");

  let successCount = 0;
  let failCount = 0;

  TEST_DIRECTORIES.forEach((dir) => {
    const success = cleanupDirectory(dir);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  });

  console.log(
    `Cleanup complete. Success: ${successCount}, Failed: ${failCount}`
  );
  return successCount;
}

// If script is run directly, execute the cleanup
if (require.main === module) {
  cleanupAllDirectories();
}

module.exports = {
  cleanupDirectory,
  cleanupAllDirectories,
  cleanupTestDirectories,
  safeDeleteFile,
};
