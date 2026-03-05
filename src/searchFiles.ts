import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import chalk from 'chalk';
import logger from './logger.js';
import type { Settings } from './types/settings.js';

//Searches for files that meet criteria
const searchFiles = (settings: Settings): Promise<string[]> => {
  const fileExtensions = settings.inputFormats.map((format) => `.${format}`);
  const searchPath = settings.inputFilePath;
  //midi can have .mid or .midi extension
  if (settings.inputFormats.includes('midi')) {
    fileExtensions.push('.mid');
  }

  const allFiles: string[] = [];

  // If we're in single file mode, just return the single file
  if (settings.singleFileMode && settings.singleFilePath) {
    const fileExtension = extname(settings.singleFilePath).toLowerCase();
    logger.log('File extension:', fileExtension);

    allFiles.push(settings.singleFilePath);
    logger.log(chalk.whiteBright.bold('\n🔍 Processing single file:\n'));
    logger.log(chalk.white(' 🎶 ', settings.singleFilePath));
    return Promise.resolve(allFiles);
  }

  const walk = (dir: string): void => {
    const files = readdirSync(dir);

    for (const file of files) {
      const inputFilePath = join(dir, file);
      const stats = statSync(inputFilePath);

      if (stats.isDirectory()) {
        // Recursively walk into subdirectories
        walk(inputFilePath);
      } else {
        // Check if the file has a matching extension
        const fileExtension = extname(file).toLowerCase();
        if (fileExtensions.includes(fileExtension)) {
          allFiles.push(inputFilePath);
        }
      }
    }
  };

  walk(searchPath);
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
