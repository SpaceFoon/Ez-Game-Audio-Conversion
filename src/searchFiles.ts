import { readdirSync, statSync, realpathSync } from 'fs';
import { join, extname } from 'path';
import chalk from 'chalk';
import logger from './logger.js';
import { recordSearchError, clearSearchErrors } from './utils.js';
import type { Settings } from './types/settings.js';

// Safety net against pathological symlink/junction loops in case canonical-path
// resolution is unavailable. Real loops are caught earlier by the visited set.
export const MAX_WALK_DEPTH = 512;

//Searches for files that meet criteria
const searchFiles = (settings: Settings): Promise<string[]> => {
  // Fresh error list for this run; reported at the end of the batch.
  clearSearchErrors();
  const fileExtensions = settings.inputFormats.map((format) => `.${format}`);
  const searchPath = settings.inputFilePath;

  const allFiles: string[] = [];

  // If we're in single file mode, just return the single file
  if (settings.singleFileMode && settings.singleFilePath) {
    const fileExtension = extname(settings.singleFilePath).toLowerCase();
    logger.log('File extension:', fileExtension);

    // Validate the explicit file against the allowed input formats so a
    // mistyped path or non-audio file (e.g. readme.txt) is rejected up front
    // instead of being handed to ffmpeg and failing mid-batch.
    if (!fileExtensions.includes(fileExtension)) {
      recordSearchError(
        settings.singleFilePath,
        `Unsupported input type "${fileExtension || '(none)'}". Expected one of: ${fileExtensions.join(', ')}`
      );
      logger.warn(
        chalk.yellowBright(
          `\n⚠️ Skipping "${settings.singleFilePath}" — not a supported input format (${settings.inputFormats.join(', ')}).`
        )
      );
      return Promise.resolve(allFiles);
    }

    allFiles.push(settings.singleFilePath);
    logger.log(chalk.whiteBright.bold('\n🔍 Processing single file:\n'));
    logger.log(chalk.white(' 🎶 ', settings.singleFilePath));
    return Promise.resolve(allFiles);
  }

  // Track canonical directory paths we've already entered so a symlink/junction
  // loop can't make us recurse forever.
  const visitedDirs = new Set<string>();

  const canonical = (dir: string): string => {
    try {
      return realpathSync(dir);
    } catch {
      // If the real path can't be resolved, fall back to the raw path so the
      // visited-set guard still does something useful.
      return dir;
    }
  };

  // A single unreadable file or folder (permissions, broken symlink, cloud
  // placeholder, locked file, etc.) must never abort the whole search. We record
  // it, keep going, and report everything at the end of the batch.
  const walk = (dir: string, depth: number): void => {
    if (depth > MAX_WALK_DEPTH) {
      recordSearchError(
        dir,
        `Maximum folder depth (${MAX_WALK_DEPTH}) exceeded — skipped deeper folders`
      );
      return;
    }

    const realDir = canonical(dir);
    if (visitedDirs.has(realDir)) return;
    visitedDirs.add(realDir);

    let files: string[];
    try {
      files = readdirSync(dir);
    } catch (error) {
      recordSearchError(dir, error);
      return;
    }

    for (const file of files) {
      const inputFilePath = join(dir, file);

      let stats;
      try {
        stats = statSync(inputFilePath);
      } catch (error) {
        recordSearchError(inputFilePath, error);
        continue;
      }

      if (stats.isDirectory()) {
        // Recursively walk into subdirectories
        walk(inputFilePath, depth + 1);
      } else {
        // Check if the file has a matching extension
        const fileExtension = extname(file).toLowerCase();
        if (fileExtensions.includes(fileExtension)) {
          allFiles.push(inputFilePath);
        }
      }
    }
  };

  walk(searchPath, 0);
  logger.log(
    chalk.whiteBright.bold('\n🔍 Matched', allFiles.length, 'Input Files:\n')
  );

  // Truncate display if more than 200 files
  const MAX_DISPLAY = 20;
  if (allFiles.length > 200) {
    allFiles.slice(0, MAX_DISPLAY).forEach((inputFile) => {
      logger.log(chalk.white(' 🎶 ', inputFile));
    });
    logger.log(
      chalk.gray(`    ... and ${allFiles.length - MAX_DISPLAY} more files`)
    );
  } else {
    allFiles.forEach((inputFile) => {
      logger.log(chalk.white(' 🎶 ', inputFile));
    });
  }

  return Promise.resolve(allFiles);
};

export default searchFiles;
