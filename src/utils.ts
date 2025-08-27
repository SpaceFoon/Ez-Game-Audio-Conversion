const readline = require('readline');
const {
  openSync,
  closeSync,
  existsSync,
  appendFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
} = require('fs');
const moment = require('moment');
const chalk = require('chalk');
const { join } = require('path');
import type { Settings, LogEntry, FileInfo } from './types/settings';

let settings: Settings = {
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
    const stdin: any = process.stdin;
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
    terminal: false,
  }) as unknown as ReadLineLike;
}

const getAnswer = (question: string | string[]): Promise<string> =>
  new Promise((resolve) => {
    // Handle array of strings (from chalk)
    const formattedQuestion = Array.isArray(question)
      ? question.join(' ')
      : question;
    rl.question(formattedQuestion, (answer: string) => {
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
const checkDiskSpace = (directory?: string): boolean => {
  // If directory is empty or undefined, use the current directory
  if (!directory) {
    directory = process.cwd();
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
const isFileBusy = async (file: string): Promise<boolean> => {
  if (!existsSync(file)) return false;
  try {
    const fd = openSync(file, 'r+');
    closeSync(fd);
    return false;
  } catch (error: any) {
    if (error.code === 'EBUSY') {
      await getAnswer(
        chalk.redBright(
          `\n${error}\n🚨🚨⛔ Close ${file} and press Enter to continue ⛔🚨🚨`
        )
      );
      return false;
    } else if (error.code === 'ENOENT') {
      console.error('code', error);
      return false;
    } else {
      console.error(
        `\n🚨🚨⛔ Error checking status of Log file: ${error.message} ⛔🚨🚨`
      );
      throw error;
    }
  }
};

// Error logging to CSV.
let fileNameL: string | null = null;
let fileNameE: string | null = null;

const initializeFileNames = () => {
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

const addToLog = async (
  log: LogEntry,
  file?: FileInfo
): Promise<boolean | void> => {
  // Ensure log file names are set
  if (!fileNameL || !fileNameE) {
    initializeFileNames();
  }
  const timestamp = moment().format('DD-MM-YYYY HH:mm:ss');
  const time = timestamp.replaceAll(',', '');
  const data = log.data?.toString().replaceAll(',', '') || 'Unknown Error';
  const inputFile =
    file?.inputFile?.replaceAll(',', '') || 'Unknown Input File';
  // Only warn on unknown error for error/stderr logs
  const outputFile =
    file?.outputFile?.replaceAll(',', '') || 'Unknown Output File';
  const isErr = log.type === 'stderr' || log.type === 'error';
  if (isErr && data === 'Unknown Error') {
    console.error('Unknown Error log, details:', log, file);
  }
  // const logPath = settings.outputFilePath;

  // Determine if the log is an error or not.
  if (isErr) {
    // console.log("log in utils", log);

    if (fileNameE) await isFileBusy(fileNameE);

    // Create error log file and header if none exists.
    if (fileNameE && !existsSync(fileNameE)) {
      try {
        writeFileSync(
          fileNameE,
          'Timestamp, Error, Input File, Output File\n',
          { encoding: 'utf8' }
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
        `${time},${data},${inputFile},${outputFile}`.replace(/[\r\n]+/g, '') +
        '\n';
      if (fileNameE) appendFileSync(fileNameE, csvRow);
    } catch (error) {
      console.error(`🚨🚨⛔ Error writing to ${fileNameE}: ${error} ⛔🚨🚨`);
      return false;
    }
    return;
  }

  // Create log file and header if none exists.
  if (fileNameL && !existsSync(fileNameL)) {
    await isFileBusy(fileNameL);
    try {
      writeFileSync(fileNameL, 'Timestamp, Exit Code, Input, Output\n', {
        encoding: 'utf8',
      });
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
      `${time},${data},${inputFile},${outputFile}`.replace(/[\r\n]+/g, '') +
      '\n';
    if (fileNameL) appendFileSync(fileNameL, csvRow);
  } catch (error) {
    console.error(`🚨🚨⛔ Error writing log to ${fileNameL}: ${error} ⛔🚨🚨`);
    return false;
  }
};

function handleExit(
  code: number = 0,
  { restart = false }: { restart?: boolean } = {}
): void {
  if (restart && code === 0) {
    const { spawn } = require('child_process');
    console.log('Restarting the app...');
    spawn(process.argv[0], process.argv.slice(1), { stdio: 'inherit' });
  }
  process.exit(code);
}

module.exports = {
  initializeFileNames,
  getAnswer,
  isFileBusy,
  addToLog,
  rl,
  settings,
  checkDiskSpace,
  handleExit,
};
