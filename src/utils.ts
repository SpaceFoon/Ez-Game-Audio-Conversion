import readline from 'readline';
import {
  openSync,
  closeSync,
  existsSync,
  appendFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import moment from 'moment';
import chalk from 'chalk';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ExitProgramError from './exitProgramError.js';
import logger from './logger.js';
import type { Settings, LogEntry, FileInfo } from './types/settings.js';

// In the SEA build, the app is bundled to CJS and `import.meta.url` may be
// missing/undefined. Fall back to CJS globals when available.
declare const __dirname: string | undefined;
declare const __filename: string | undefined;

const moduleFilename = (() => {
  try {
    if (typeof import.meta?.url === 'string' && import.meta.url) {
      return fileURLToPath(import.meta.url);
    }
  } catch {
    // ignore
  }
  if (typeof __filename === 'string' && __filename) {
    return __filename;
  }
  return '';
})();

const moduleDirname = (() => {
  if (moduleFilename) {
    return dirname(moduleFilename);
  }
  if (typeof __dirname === 'string' && __dirname) {
    return __dirname;
  }
  return process.cwd();
})();

// Replaced at compile time by esbuild --define in build-sea.js.
// In dev (unbundled ESM) the global doesn't exist, so falls back to false.
declare const __SEA_BUILD__: boolean | undefined;
export const isSeaRuntime =
  typeof __SEA_BUILD__ !== 'undefined' && __SEA_BUILD__;
export const isPackagedRuntime =
  isSeaRuntime ||
  Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg) ||
  process.env.PKG_ENV === 'packaging';
export const runtimeBaseDir = isPackagedRuntime
  ? dirname(process.execPath)
  : join(moduleDirname, '..');
export const platformSlug =
  process.platform === 'win32'
    ? 'windows'
    : process.platform === 'darwin'
      ? 'macos'
      : 'linux';

/** Extract error message from unknown caught value */
export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'Unknown error');

// Files/folders that could not be read during the recursive search.
// Collected here so the search can keep going and report everything at the
// end of the batch (terminal + error.csv) instead of crashing the whole app.
export interface SearchError {
  path: string;
  message: string;
}

let searchErrors: SearchError[] = [];

/** Record a path that could not be read during the recursive file search. */
export const recordSearchError = (path: string, error: unknown): void => {
  searchErrors.push({ path, message: getErrorMessage(error) });
};

/** Snapshot of the search errors collected so far. */
export const getSearchErrors = (): SearchError[] => [...searchErrors];

/** Clear collected search errors. Called at the start of each search run. */
export const clearSearchErrors = (): void => {
  searchErrors = [];
};

/**
 * Locate a bundled binary (ffmpeg, ffprobe, or worker file) by searching
 * the two directory roots that actually exist at runtime:
 *   1. runtimeBaseDir  – next to the SEA exe, or project root in dev
 *   2. process.cwd()   – for when the user runs from the release folder
 *
 * `subdirs` are the relative paths to check under each root, e.g.
 * `['ffmpeg-bin/windows']` or `['dist']`.
 */
export const findBinary = (
  name: string,
  subdirs: string[] = []
): string | null => {
  const roots = [runtimeBaseDir, process.cwd()];
  for (const root of roots) {
    // Check directly under root
    const direct = join(root, name);
    if (existsSync(direct)) return direct;
    // Check each sub-directory
    for (const sub of subdirs) {
      const candidate = join(root, sub, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
};

export let settings: Settings = {
  inputFilePath: '',
  outputFilePath: '',
  inputFormats: [],
  outputFormats: [],
  oggCodec: null,
  singleFileMode: false,
  singleFilePath: '',
};

// Provide a Jest-friendly stub to avoid open handle (TTYWRAP) issues during tests
type ReadLineLike = {
  question: (q: string, cb: (answer: string) => void) => void;
  close: () => void;
};

let rl: ReadLineLike;
if (process.env.JEST_WORKER_ID) {
  // In Jest, do not bind to real stdio to prevent open handles
  rl = {
    question: (_q: string, cb: (answer: string) => void) => cb(''),
    close: () => {},
  };
  // Fully release the TTY handle so Jest can exit cleanly.
  try {
    process.stdin.unref();
    process.stdin.pause();
    process.stdin.destroy();
  } catch {
    // Ignore stdin cleanup errors
  }
} else {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  }) as unknown as ReadLineLike;
}

export const getAnswer = (question: string | string[]): Promise<string> =>
  new Promise((resolve) => {
    // Handle array of strings (from chalk)
    const formattedQuestion = Array.isArray(question)
      ? question.join(' ')
      : question;
    // Always echo the question so Windows PowerShell/cmd users see it even if ANSI is suppressed
    logger.log(formattedQuestion);
    rl.question('', (answer: string) => {
      resolve(answer);
    });
  });

// If a file fails to read or write, check if it is busy.
// Returns true if the file is still locked, false if it is free to use.
export const isFileBusy = async (file: string): Promise<boolean> => {
  if (!existsSync(file)) return false;

  // After prompting the user to close the file we must actually re-check the
  // lock; returning early would let callers write to a still-locked file. Cap
  // the retries so a file that never gets closed can't spin forever.
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const fd = openSync(file, 'r+');
      closeSync(fd);
      return false;
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'EBUSY') {
        await getAnswer(
          chalk.redBright(
            `\n${String(error)}\n🚨🚨⛔ Close ${file} and press Enter to continue ⛔🚨🚨`
          )
        );
        // Loop and re-open to confirm the user actually released the lock.
        continue;
      } else if (err?.code === 'ENOENT') {
        logger.error('ENOENT while checking file status:', String(error));
        return false;
      } else {
        logger.error(
          `\n🚨🚨⛔ Error checking status of Log file: ${err?.message ?? String(error)} ⛔🚨🚨`
        );
        throw error;
      }
    }
  }

  logger.error(
    `\n🚨🚨⛔ ${file} is still locked after ${maxAttempts} attempts. Giving up. ⛔🚨🚨`
  );
  return true;
};

// Error logging to CSV.
let fileNameL: string | null = null;
let fileNameE: string | null = null;

// Test helpers to control log file state in a platform-agnostic way
export const __setLogFileStateForTests = (
  logPath: string | null = fileNameL,
  errorPath: string | null = fileNameE
): void => {
  fileNameL = logPath;
  fileNameE = errorPath;
};

export const __getLogFileStateForTests = (): {
  logFile: string | null;
  errorFile: string | null;
} => ({
  logFile: fileNameL,
  errorFile: fileNameE,
});

export const initializeFileNames = () => {
  const basePath = settings.outputFilePath || '';
  // Ensure output directory exists once (cross-platform)
  if (basePath) {
    try {
      if (typeof mkdirSync === 'function') {
        mkdirSync(basePath, { recursive: true });
      }
    } catch (err) {
      logger.error('Error ensuring log directory exists:', err);
    }
  }
  fileNameL = initFileName(basePath, 'logs');
  fileNameE = initFileName(basePath, 'error');
};

/** Resolve the next available CSV log path, optionally using a custom occupancy check. */
export const nextAvailableLogCsvPath = (
  basePath: string,
  fileName: string,
  isTaken: (path: string) => boolean = existsSync
): string => {
  let num = 1;
  const norm = (p: string) => p.replace(/\\/g, '/');
  let fullFileName = norm(join(basePath || '', `${fileName}.csv`));

  while (isTaken(fullFileName)) {
    fullFileName = norm(join(basePath || '', `${fileName}(${num}).csv`));
    num++;
  }

  return fullFileName;
};

const initFileName = (basePath: string, fileName: string): string =>
  nextAvailableLogCsvPath(basePath, fileName);

/** Leading chars Excel/LibreOffice may interpret as formulas when opening CSV. */
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escapes a value for CSV format.
 * Prefixes formula-triggering leading characters with a single quote (Excel-safe).
 * If the value contains commas, quotes, or newlines, wrap it in quotes and escape internal quotes.
 * This is platform-agnostic - works on Windows, Mac, and Linux.
 */
export function escapeCsvField(value: string): string {
  const safe =
    CSV_FORMULA_PREFIX.test(value) && !value.startsWith("'")
      ? `'${value}`
      : value;

  if (
    safe.includes(',') ||
    safe.includes('"') ||
    safe.includes('\n') ||
    safe.includes('\r')
  ) {
    // Escape double quotes by doubling them, then wrap in quotes
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

const normalizeCsvValue = (value: string): string =>
  value.replace(/[\r\n]+/g, ' ');

const buildCsvRow = (values: string[]): string =>
  values.map((value) => escapeCsvField(value)).join(',') + '\n';

const ensureCsvHeader = async (
  filePath: string | null,
  header: string,
  onError: (error: unknown) => void
): Promise<boolean> => {
  if (!filePath) return false;
  if (existsSync(filePath)) return true;

  try {
    await isFileBusy(filePath);
    writeFileSync(filePath, '\uFEFF' + header + '\n', {
      encoding: 'utf8',
    });
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
};

const appendCsvRow = async (
  filePath: string | null,
  row: string,
  onError: (error: unknown) => void
): Promise<boolean> => {
  if (!filePath) return false;

  try {
    await isFileBusy(filePath);
    appendFileSync(filePath, row);
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
};

export const addToLog = async (
  log: LogEntry,
  file?: FileInfo
): Promise<boolean | void> => {
  // Ensure log file names are set
  if (!fileNameL || !fileNameE) {
    initializeFileNames();
  }
  const timestamp = moment().format('DD-MM-YYYY HH:mm:ss');
  const time = timestamp;
  const data = log.data != null ? String(log.data) : 'Unknown Error';
  const inputFile = file?.inputFile || 'Unknown Input File';
  // Only warn on unknown error for error/stderr logs
  const outputFile = file?.outputFile || 'Unknown Output File';
  const isErr = log.type === 'stderr' || log.type === 'error';
  if (isErr && data === 'Unknown Error') {
    logger.error('Unknown Error log, details:', log, file);
  }
  // const logPath = settings.outputFilePath;

  // Extract exit code for error logs
  let exitCode = '';
  if (log.type === 'code') {
    exitCode = String(log.data);
  } else if (isErr && typeof data === 'string') {
    // Try to parse exit code from error message like "ffmpeg exited with code 123"
    const match = data.match(/exited with code (\d+)/i);
    exitCode = (match && match[1]) || 'N/A';
  }

  // Determine if the log is an error or not.
  if (isErr) {
    const hasErrorHeader = await ensureCsvHeader(
      fileNameE,
      'Timestamp,"Exit Code",Error,"Input File","Output File"',
      (error) => {
        logger.error('Error creating Error CSV file: ', error);
      }
    );
    if (!hasErrorHeader) {
      return false;
    }

    const errorRow = buildCsvRow([
      time,
      exitCode,
      normalizeCsvValue(data),
      inputFile,
      outputFile,
    ]);
    const wroteErrorRow = await appendCsvRow(fileNameE, errorRow, (error) => {
      logger.error(`🚨🚨⛔ Error writing to ${fileNameE}: ${error} ⛔🚨🚨`);
    });
    if (!wroteErrorRow) {
      return false;
    }

    const hasLogHeader = await ensureCsvHeader(
      fileNameL,
      'Timestamp,"Exit Code",Input,Output',
      (error) => {
        logger.error(
          `🚨🚨⛔ Error creating file or making header to ${fileNameL}: ${error} ⛔🚨🚨`
        );
      }
    );
    if (!hasLogHeader) {
      return false;
    }

    const logCsvRow = buildCsvRow([time, exitCode, inputFile, outputFile]);
    const wroteLogRow = await appendCsvRow(fileNameL, logCsvRow, (error) => {
      logger.error(`🚨🚨⛔ Error writing to ${fileNameL}: ${error} ⛔🚨🚨`);
    });
    if (!wroteLogRow) {
      return false;
    }

    return;
  }

  const hasLogHeader = await ensureCsvHeader(
    fileNameL,
    'Timestamp,"Exit Code",Input,Output',
    (error) => {
      logger.error(
        `🚨🚨⛔ Error creating file or making header to ${fileNameL}: ${error} ⛔🚨🚨`
      );
    }
  );
  if (!hasLogHeader) {
    return false;
  }

  const csvRow = buildCsvRow([
    time,
    normalizeCsvValue(data),
    inputFile,
    outputFile,
  ]);
  const wroteLogRow = await appendCsvRow(fileNameL, csvRow, (error) => {
    logger.error(`🚨🚨⛔ Error writing log to ${fileNameL}: ${error} ⛔🚨🚨`);
  });
  if (!wroteLogRow) {
    return false;
  }
};

/**
 * Print a summary of any files/folders that could not be read during the
 * recursive search, write each one to error.csv, then clear the list.
 * No-op when there were no search errors. Never throws.
 */
export const reportSearchErrors = async (): Promise<void> => {
  const errors = getSearchErrors();
  if (errors.length === 0) return;

  logger.warn(
    chalk.yellowBright(
      `\n⚠️  ${errors.length} item(s) could not be read and were skipped during the file search:`
    )
  );
  const MAX_SHOWN = 20;
  for (const entry of errors.slice(0, MAX_SHOWN)) {
    logger.warn(chalk.yellow(`   • ${entry.path}\n     ${entry.message}`));
  }
  if (errors.length > MAX_SHOWN) {
    logger.warn(
      chalk.gray(`   ... and ${errors.length - MAX_SHOWN} more (see error.csv)`)
    );
  }
  logger.warn(
    chalk.gray('   These were recorded in error.csv for your reference.')
  );

  for (const entry of errors) {
    try {
      await addToLog(
        {
          type: 'error',
          data: `Unreadable path skipped during search: ${entry.message}`,
        },
        { inputFile: entry.path, outputFile: '[search]' }
      );
    } catch (logError) {
      logger.error(
        'Failed to log search error to CSV:',
        getErrorMessage(logError)
      );
    }
  }

  clearSearchErrors();
};

export function handleExit(code: number = 0): void {
  throw new ExitProgramError(`EXIT_PROGRAM:${code}`);
}

export function writeSummaryToLogs(
  totalFiles: number,
  successCount: number,
  failCount: number,
  durationSeconds: number
): void {
  const timestamp = moment().format('DD-MM-YYYY HH:mm:ss');
  const summary = `SUMMARY: Total=${totalFiles}, Passed=${successCount}, Failed=${failCount}, Duration=${durationSeconds.toFixed(2)}s`;

  // Write to logs.csv
  try {
    if (fileNameL && existsSync(fileNameL)) {
      const logRow =
        [escapeCsvField(timestamp), '', escapeCsvField(summary), ''].join(',') +
        '\n';
      appendFileSync(fileNameL, logRow);
    }
  } catch (error) {
    logger.error(`Error writing summary to logs: ${error}`);
  }

  // Write to error.csv
  try {
    if (fileNameE && existsSync(fileNameE)) {
      const errorRow =
        [escapeCsvField(timestamp), '', escapeCsvField(summary), '', ''].join(
          ','
        ) + '\n';
      appendFileSync(fileNameE, errorRow);
    }
  } catch (error) {
    logger.error(`Error writing summary to errors: ${error}`);
  }
}

export { rl };
