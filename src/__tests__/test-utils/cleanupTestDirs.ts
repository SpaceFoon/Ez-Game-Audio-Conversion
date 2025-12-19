/**
 * Test Utilities - Cleanup Test Directories
 *
 * This script allows cleaning up test directories to free disk space
 * after tests have been run. It can be run manually or on a schedule.
 */

import {
  existsSync,
  unlinkSync,
  readdirSync,
  statSync,
  rmSync,
  mkdirSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add directories to clean up here
const TEST_DIRECTORIES = [
  join(__dirname, '..', 'test-assets'),
  join(process.cwd(), 'format-test'),
  join(process.cwd(), 'loop-test'),
  join(process.cwd(), 'test-audio'),
  join(process.cwd(), 'tag-test'),
  join(process.cwd(), 'direct-test'),
  join(process.cwd(), 'test-samplerates'),
  join(process.cwd(), 'final-test'),
];

/**
 * Safely delete a file, handling permissions errors
 */
function safeDeleteFile(filePath) {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
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
    if (existsSync(dir)) {
      try {
        const files = readdirSync(dir);
        for (const file of files) {
          safeDeleteFile(join(dir, file));
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
  if (!existsSync(dirPath)) {
    console.log(`Directory does not exist: ${dirPath}`);
    return true;
  }

  try {
    const stats = statSync(dirPath);
    if (!stats.isDirectory()) {
      console.log(`Not a directory: ${dirPath}`);
      return false;
    }

    console.log(`Cleaning up directory: ${dirPath}`);
    rmSync(dirPath, { recursive: true, force: true });

    // If directory should remain, recreate it empty
    mkdirSync(dirPath, { recursive: true });

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
  console.log('Starting test directory cleanup...');

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
if (process.argv[1] === __filename) {
  cleanupAllDirectories();
}

export default {
  cleanupDirectory,
  cleanupAllDirectories,
  cleanupTestDirectories,
  safeDeleteFile,
};
