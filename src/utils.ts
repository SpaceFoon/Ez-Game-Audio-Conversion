import readline from 'readline';
import {
  openSync,
  closeSync,
  existsSync,
  appendFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
} from 'fs';
import moment from 'moment';
import chalk from 'chalk';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import type { Settings, LogEntry, FileInfo } from './types/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const seaFuseKey = Object.keys(process.env).find((key) =>
  key.startsWith('NODE_SEA_FUSE_')
);
export const isSeaRuntime = Boolean(seaFuseKey);
export const isPackagedRuntime =
  isSeaRuntime ||
  Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg) ||
  process.env.PKG_ENV === 'packaging';
export const runtimeBaseDir = isPackagedRuntime
  ? dirname(process.execPath)
  : join(__dirname, '..');
export const platformSlug =
  process.platform === 'win32'
    ? 'windows'
    : process.platform === 'darwin'
      ? 'macos'
      : 'linux';

export let settings: Settings = {
  inputFilePath: '',
  outputFilePath: '',
  inputFormats: [],
  outputFormats: [],
  oggCodec: null,
  singleFileMode: false,
  singleFilePath: '',
  //bitrate: 0, placeholder for future options
  //quality: 2,
  userOS: null,
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
  // Attempt to fully release the TTY handle so Jest can exit cleanly.
  try {
    const stdin = process.stdin as NodeJS.ReadStream & {
      unref?: () => void;
      pause?: () => void;
      destroy?: () => void;
    };
    if (stdin) {
      if (typeof stdin.unref === 'function') {
        try {
          stdin.unref();
        } catch {
          // Ignore cleanup errors
        }
      }
      if (typeof stdin.pause === 'function') {
        try {
          stdin.pause();
        } catch {
          // Ignore cleanup errors
        }
      }
      if (typeof stdin.destroy === 'function') {
        try {
          stdin.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    }
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
    console.log(formattedQuestion);
    rl.question('', (answer: string) => {
      resolve(answer);
    });
  });

// Override console.error with a custom function
const originalConsoleError = console.error;
console.error = function (...args) {
  const coloredArgs = args.map((arg) => {
    if (arg instanceof Error) {
      const txt = arg.stack || arg.message || String(arg);
      return chalk.red.bold(txt);
    }
    return typeof arg === 'string' ? chalk.red.bold(arg) : arg;
  });
  originalConsoleError.apply(console, coloredArgs);
};
// Save the original console.warn function
const originalConsoleWarn = console.warn;
console.warn = function (...args) {
  const coloredArgs = args.map((arg) => {
    if (arg instanceof Error) {
      const txt = arg.stack || arg.message || String(arg);
      return chalk.yellow.bold(txt);
    }
    return typeof arg === 'string' ? chalk.yellow.bold(arg) : arg;
  });
  originalConsoleWarn.apply(console, coloredArgs);
};

// If a file is not writing, check the disk space.
export const checkDiskSpace = (directory?: string): boolean => {
  // If directory is empty or undefined, warn and continue
  if (!directory) {
    console.warn(
      chalk.yellow.bold(
        '\nWARNING: No directory provided for disk space check. Unable to verify available space; assuming enough disk for now.'
      )
    );
    return true;
  }

  try {
    // On Windows, this approach is more reliable
    statSync(directory);

    // Windows doesn't reliably provide blocks/blksize
    // Instead, use freespace directly if available, or a reasonable default
    return true;
  } catch (error) {
    console.error(`Error checking disk space: ${(error as Error).message}`);
    // Default to true so conversion isn't blocked by disk space check errors
    return true;
  }
};

// If a file fails to read or write, check if it is busy.
export const isFileBusy = async (file: string): Promise<boolean> => {
  if (!existsSync(file)) return false;
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
      return false;
    } else if (err?.code === 'ENOENT') {
      console.error('code', String(error));
      return false;
    } else {
      console.error(
        `\n🚨🚨⛔ Error checking status of Log file: ${err?.message ?? String(error)} ⛔🚨🚨`
      );
      throw error;
    }
  }
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
      console.error('Error ensuring log directory exists:', err);
    }
  }
  fileNameL = initFileName(basePath, 'logs');
  fileNameE = initFileName(basePath, 'error');
};

const initFileName = (basePath: string, fileName: string): string => {
  let num = 1;
  // Use OS-aware join and normalize to forward slashes for test stability on Windows
  const norm = (p: string) => p.replace(/\\/g, '/');
  let fullFileName = norm(join(basePath || '', `${fileName}.csv`));

  while (existsSync(fullFileName)) {
    fullFileName = norm(join(basePath || '', `${fileName}(${num}).csv`));
    num++;
  }

  return fullFileName;
};

/**
 * Escapes a value for CSV format.
 * If the value contains commas, quotes, or newlines, wrap it in quotes and escape internal quotes.
 * This is platform-agnostic - works on Windows, Mac, and Linux.
 */
export function escapeCsvField(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    // Escape double quotes by doubling them, then wrap in quotes
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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
    console.error('Unknown Error log, details:', log, file);
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
    // console.log("log in utils", log);

    if (fileNameE) await isFileBusy(fileNameE);

    // Create error log file and header if none exists.
    if (fileNameE && !existsSync(fileNameE)) {
      try {
        writeFileSync(
          fileNameE,
          '\uFEFF' + 'Timestamp,"Exit Code",Error,"Input File","Output File"\n',
          {
            encoding: 'utf8',
          }
        );
        // Header created; continue to write the current log line below
      } catch (error) {
        console.error('Error creating Error CSV file: ', error);
        return false; // bail out safely
      }
    }

    // Write error line
    try {
      if (fileNameE) await isFileBusy(fileNameE);
      const csvRow =
        [
          escapeCsvField(time),
          escapeCsvField(exitCode),
          escapeCsvField(data.replace(/[\r\n]+/g, ' ')),
          escapeCsvField(inputFile),
          escapeCsvField(outputFile),
        ].join(',') + '\n';
      if (fileNameE) appendFileSync(fileNameE, csvRow);
    } catch (error) {
      console.error(`🚨🚨⛔ Error writing to ${fileNameE}: ${error} ⛔🚨🚨`);
      return false;
    }

    // Also log errors to logs.csv
    try {
      if (fileNameL && !existsSync(fileNameL)) {
        await isFileBusy(fileNameL);
        writeFileSync(
          fileNameL,
          '\uFEFF' + 'Timestamp,"Exit Code",Input,Output\n',
          {
            encoding: 'utf8',
          }
        );
      }
      if (fileNameL) await isFileBusy(fileNameL);
      const logCsvRow =
        [
          escapeCsvField(time),
          escapeCsvField(exitCode),
          escapeCsvField(inputFile),
          escapeCsvField(outputFile),
        ].join(',') + '\n';
      if (fileNameL) appendFileSync(fileNameL, logCsvRow);
    } catch (error) {
      console.error(`🚨🚨⛔ Error writing to ${fileNameL}: ${error} ⛔🚨🚨`);
      return false;
    }

    return;
  }

  // Create log file and header if none exists.
  if (fileNameL && !existsSync(fileNameL)) {
    await isFileBusy(fileNameL);
    try {
      // Create log file with BOM for UTF-8. Hopefully avoids software not detecting this is CSV.
      writeFileSync(
        fileNameL,
        '\uFEFF' + 'Timestamp,"Exit Code",Input,Output\n',
        {
          encoding: 'utf8',
        }
      );
    } catch (error) {
      console.error(
        `🚨🚨⛔ Error creating file or making header to ${fileNameL}: ${error} ⛔🚨🚨`
      );
      return false;
    }
  }
  // Write log line
  try {
    if (fileNameL) await isFileBusy(fileNameL);
    const csvRow =
      [
        escapeCsvField(time),
        escapeCsvField(data.replace(/[\r\n]+/g, ' ')),
        escapeCsvField(inputFile),
        escapeCsvField(outputFile),
      ].join(',') + '\n';
    if (fileNameL) appendFileSync(fileNameL, csvRow);
  } catch (error) {
    console.error(`🚨🚨⛔ Error writing log to ${fileNameL}: ${error} ⛔🚨🚨`);
    return false;
  }
};

export function handleExit(
  code: number = 0,
  { restart = false }: { restart?: boolean } = {}
): void {
  if (restart && code === 0 && process.argv[0]) {
    console.log('Restarting the app...');
    spawn(process.argv[0], process.argv.slice(1), { stdio: 'inherit' });
  }
  process.exit(code);
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
    console.error(`Error writing summary to logs: ${error}`);
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
    console.error(`Error writing summary to errors: ${error}`);
  }
}

export { rl };
