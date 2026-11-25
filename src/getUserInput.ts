import { existsSync, mkdirSync, statSync } from 'fs';
import chalk from 'chalk';
import { dirname, extname, resolve } from 'path';
import * as os from 'os';
import { getAnswer } from './utils.js';
import ExitProgramError, { UserQuitError } from './exitProgramError.js';
import logger from './logger.js';
import type { Settings } from './types/settings.js';
import type { AudioFormat } from './types/audio.js';

const inputTypes: AudioFormat[] = ['flac', 'aiff', 'wav', 'mp3', 'm4a', 'ogg'];
const outputTypes: AudioFormat[] = ['flac', 'aiff', 'wav', 'mp3', 'm4a', 'ogg'];

/** Parse comma/space-separated format string. Returns all allowed if blank. Silently drops invalid tokens. */
export const parseFormats = (
  formatString: string,
  allowed: AudioFormat[]
): AudioFormat[] => {
  if (formatString.trim() === '') return [...allowed];

  // Common alternative spellings.
  const aliases: Record<string, string> = { aif: 'aiff', opus: 'ogg' };
  return [
    ...new Set(
      formatString
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((f) => f.replace(/^\./, ''))
        .map((f) => aliases[f] ?? f)
        .filter((f): f is AudioFormat => allowed.includes(f as AudioFormat))
    ),
  ];
};

/**
 * Clean a pasted or dragged-in path:
 * - trim whitespace and drop one pair of matching surrounding quotes
 *   (Windows "Copy as path" and drag-and-drop add them);
 * - on macOS/Linux, undo shell escaping (`My\\ Folder` → `My Folder`), which
 *   is how Terminal and most Linux terminals drop a path in;
 * - expand a leading `~` to the home folder.
 */
export const cleanPathInput = (
  raw: string,
  platform: NodeJS.Platform = process.platform
): string => {
  const trimmed = raw.trim();
  const match = /^(["'])(.*)\1$/.exec(trimmed);
  let path = (match ? match[2]! : trimmed).trim();
  // Backslash is the path separator on Windows, so leave it alone there.
  if (!match && platform !== 'win32') path = path.replace(/\\(.)/g, '$1');
  if (path === '~' || path.startsWith('~/') || path.startsWith('~\\')) {
    path = (os.homedir?.() ?? '~') + path.slice(1);
  }
  return path;
};

/** Words that quit the app at the input-folder prompt. */
const QUIT_WORDS = new Set(['q', 'quit', 'exit']);

const promptOutputPath = async (
  inputFilePath: string,
  promptText: string
): Promise<string> => {
  while (true) {
    const answer = cleanPathInput(await getAnswer(chalk.blue.bold(promptText)));
    const outputFilePath = answer === '' ? inputFilePath : resolve(answer);

    if (!existsSync(outputFilePath)) {
      logger.warn('\n⚠️ File Path does not exist! 👨‍🏭 Creating folder... 🚧');
      try {
        mkdirSync(outputFilePath, { recursive: true });
      } catch {
        logger.error('Failed to create folder at:', outputFilePath);
        continue;
      }
    }

    if (!statSync(outputFilePath).isDirectory()) {
      logger.warn('\n⚠️ Output path must be a folder.');
      continue;
    }

    logger.log(chalk.green.italic(`\n📝 Output Folder: ${outputFilePath} ✅`));
    return outputFilePath;
  }
};

const promptInputFormats = async (): Promise<AudioFormat[]> => {
  while (true) {
    const input = await getAnswer(
      chalk.blue.bold(
        '\n✏️  Enter the file extensions to look for. Leave blank for all 🚨 (e.g., ogg, mp3, m4a, wav, aiff, flac): '
      )
    );

    const formats = parseFormats(input, inputTypes);

    if (formats.length === 0) {
      logger.warn(
        '\n🛑 Invalid input format 🛑\n⚠️ Only ogg, mp3, m4a, wav, aiff and flac are allowed'
      );
      continue;
    }

    logger.log(
      chalk.green.italic(
        `\n📝 Input formats: ${formats.map((el) => `${el} ✅`).join(' ')}`
      )
    );
    return formats;
  }
};

const promptOutputFormats = async (): Promise<AudioFormat[]> => {
  while (true) {
    const input = await getAnswer(
      chalk.blue.bold(
        '\n✏️  Enter the output formats. Leave blank for all 🚨 (e.g., ogg, mp3, m4a, wav, aiff, flac): '
      )
    );

    const formats = parseFormats(input, outputTypes);

    if (formats.length === 0) {
      logger.warn(
        '\n🛑 Invalid output format 🛑\n⚠️ Only ogg, mp3, m4a, wav, aiff and flac are allowed!'
      );
      continue;
    }

    logger.log(
      chalk.green.italic(
        `\n📝 Output formats: ${formats.map((el) => `${el} ✅`).join(' ')}`
      )
    );
    return formats;
  }
};

// Entire input loop to get settings before converting.
// `useCliArg` is true only on the first run: a folder/file passed on the
// command line seeds that run, and later runs ask for a new input path.
const getUserInput = async (
  settings: Settings,
  { useCliArg = true }: { useCliArg?: boolean } = {}
): Promise<Settings> => {
  // Ogg Vorbis/Opus is chosen per batch in createConversionList; never reuse a prior run.
  settings.oggCodec = null;

  const argPath = useCliArg ? process.argv[2]?.trim() : undefined;

  if (argPath) {
    const resolvedArgPath = resolve(argPath);

    if (!existsSync(resolvedArgPath)) {
      logger.warn(`\n⚠️ Command-line path does not exist: ${resolvedArgPath}`);
    } else {
      const pathStats = statSync(resolvedArgPath);

      if (pathStats.isFile()) {
        const rawExt = extname(resolvedArgPath).toLowerCase().substring(1);
        // .aif is the short spelling of AIFF.
        const fileExt = (
          rawExt === 'aif' ? 'aiff' : rawExt === 'opus' ? 'ogg' : rawExt
        ) as AudioFormat;

        if (!inputTypes.includes(fileExt)) {
          logger.error(
            chalk.red.bold(`\n❌ Unsupported file type: ${fileExt}`)
          );
          logger.error(
            chalk.red(`Supported file types: ${inputTypes.join(', ')}`)
          );
          throw new ExitProgramError('EXIT_PROGRAM:1');
        }

        settings.inputFilePath = dirname(resolvedArgPath);
        settings.singleFileMode = true;
        settings.singleFilePath = resolvedArgPath;
        settings.inputFormats = [fileExt];
        logger.log(
          chalk.green.italic(
            `\n📝 Processing single file: ${resolvedArgPath} ✅`
          )
        );
        logger.log(chalk.green.italic(`File extension: ${fileExt}`));
      } else if (pathStats.isDirectory()) {
        settings.inputFilePath = resolvedArgPath;
        settings.singleFileMode = false;
        logger.log(
          chalk.green.italic(`\n📝 Input Folder: ${settings.inputFilePath} ✅`)
        );
      } else {
        logger.error('\n❌ Path must be a file or folder.');
        throw new ExitProgramError('EXIT_PROGRAM:1');
      }

      settings.outputFilePath = await promptOutputPath(
        settings.inputFilePath,
        '\n✏️  Enter the output folder for converted file(s). 🚨 Leave blank for same folder as input 📂:'
      );

      if (!settings.singleFileMode) {
        settings.inputFormats = await promptInputFormats();
      }

      settings.outputFormats = await promptOutputFormats();
      return settings;
    }
  }

  // No valid command-line argument — interactive mode
  while (true) {
    const rawInputPath = await getAnswer(
      chalk.blue.bold(
        '\n 📁 Choose the folder to search for files to convert. ',
        '\n 🔍 This will recursively search, ie: all subfolders ',
        '\n 🐭 Right-click to paste. ',
        '\n ✏️  Input Folder Path (or q to quit): '
      )
    );

    const inputFilePath = cleanPathInput(rawInputPath);

    // Quit, unless a folder with that name really exists here.
    if (
      QUIT_WORDS.has(inputFilePath.toLowerCase()) &&
      !existsSync(resolve(inputFilePath))
    ) {
      throw new UserQuitError();
    }

    // resolve('') is the working directory; never pick that silently.
    if (inputFilePath === '') {
      logger.warn('\n⚠️  Please enter a folder path.');
      continue;
    }

    const resolvedInputPath = resolve(inputFilePath);

    if (!existsSync(resolvedInputPath)) {
      logger.warn('\n⚠️  File Path does not exist! 🔍');
      continue;
    }

    if (!statSync(resolvedInputPath).isDirectory()) {
      logger.warn('\n⚠️  Path must be a folder, not a file.');
      continue;
    }

    settings.inputFilePath = resolvedInputPath;
    settings.singleFileMode = false;
    logger.log(
      chalk.green.italic(`\n📝 Input Folder: ${settings.inputFilePath} ✅`)
    );
    break;
  }

  settings.outputFilePath = await promptOutputPath(
    settings.inputFilePath,
    '\n✏️  Enter the output folder for converted file(s). 🚨 Leave blank for same folder as input files 📂:'
  );
  settings.inputFormats = await promptInputFormats();
  settings.outputFormats = await promptOutputFormats();

  return settings;
};

export default getUserInput;
