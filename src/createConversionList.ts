import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import {
  join,
  basename,
  extname,
  dirname,
  relative,
  resolve,
  isAbsolute,
} from 'path';
import chalk from 'chalk';
import {
  getAnswer,
  settings,
  handleExit,
  getErrorMessage,
  reportSearchErrors,
} from './utils.js';
import logger from './logger.js';
import { isSamePath, pathKey, realPathOr } from './pathKey.js';
import { findLoopTaggedFile } from './loopTagScan.js';
import type { LoopDataMode } from './types/settings.js';
import type {
  AudioFormat,
  ConversionCandidate,
  ConversionItem,
  OggCodec,
} from './types/audio.js';

/** Parse `-copy(n)` suffix from a filename for rename conflict resolution. */
export const parseCopyFilename = (
  filename: string
): { base: string; num: number } => {
  const baseName = basename(filename, extname(filename));
  const match = baseName.match(/^(.+)-copy\((\d+)\)$/);

  if (match?.[1] && match[2]) {
    return { base: match[1], num: parseInt(match[2], 10) };
  }

  return { base: baseName, num: 0 };
};

/** Build output path preserving folder structure relative to input root. */
export const buildOutputPath = (
  inputFile: string,
  inputRoot: string,
  outputRoot: string,
  outputFormat: string
): string => {
  const relativePath = getRelativeOutputDir(inputRoot, inputFile);
  const outputFolder = join(outputRoot, relativePath);
  return join(
    outputFolder,
    `${basename(inputFile, extname(inputFile))}.${outputFormat}`
  );
};

export const buildBasenameWithFormat = (
  inputFile: string,
  outputFormat: string
): string => `${basename(inputFile, extname(inputFile))}.${outputFormat}`;

export const pathsResolveToSameFile = (
  inputFile: string,
  outputFile: string
): boolean => isSamePath(inputFile, outputFile);

// Get a unique output file name. `isReserved` reports names already planned
// in this batch (not yet on disk) so two outputs never get the same copy name.
const getOutputFileCopy = async (
  inputFile: string,
  outputFormat: AudioFormat,
  outputFolder: string,
  isReserved: (filePath: string) => boolean = () => false,
  copyNumber: number = 1
): Promise<string> => {
  const parsed = parseCopyFilename(inputFile);
  let baseNameCopy = parsed.base;
  if (parsed.num > 0) {
    copyNumber = parsed.num + 1;
  }
  let outputFileCopy = `${join(
    outputFolder,
    `${baseNameCopy}-copy(${copyNumber})`
  )}.${outputFormat}`;
  if (existsSync(outputFileCopy) || isReserved(outputFileCopy)) {
    outputFileCopy = await getOutputFileCopy(
      outputFileCopy,
      outputFormat,
      outputFolder,
      isReserved,
      copyNumber + 1
    );
  }

  return outputFileCopy;
};

const askOggCodec = async (): Promise<OggCodec> => {
  //Choose codec for OGG
  const userResponse = await getAnswer(
    chalk.blue.bold(
      '\n🔊 Which codec would you like to use for Ogg files? 🎼 Vorbis or Opus?',
      '\n🎵 Note: Opus is better 💪 but Vorbis works with more game engines. 🎮 🚗',
      '\n\n💡 If you are unsure, leave blank for Vorbis: '
    )
  );

  // Process the user input
  const input = userResponse.trim().toLowerCase();

  if (input === '') {
    settings.oggCodec = 'vorbis';
    logger.log(chalk.green.italic('\n ✨ Ogg Codec 🔌 Selected: vorbis ✅'));
    return 'vorbis';
  }
  if (input !== 'vorbis' && input !== 'opus') {
    logger.warn('\n⚠️ Did not enter Vorbis or Opus! 😧😓😯');
    return await askOggCodec(); // Keep asking until a valid input is provided
  }

  // Save the selection to settings and return
  settings.oggCodec = input;
  logger.log(chalk.green.italic(`\n ✨ Ogg Codec 🔌 Selected: ${input} ✅`));
  return input;
};

/**
 * Ask what to do with loop tags. `offerForce` is true when WAV or M4A is
 * among the outputs: those formats can't store loop tags reliably, so by
 * default they are left out there.
 */
export const askLoopDataMode = async (
  exampleFile: string,
  offerForce: boolean
): Promise<LoopDataMode> => {
  while (true) {
    const answer = (
      await getAnswer(
        chalk.blue.bold(
          `\n🔁 Some input files have loop points (e.g. ${basename(exampleFile)}).`,
          '\n   Leave blank to keep them in OGG, FLAC, MP3 and AIFF outputs.',
          '\n   Type "skip" to leave loop tags out of every output.',
          ...(offerForce
            ? [
                '\n   Type "force" to also write them to WAV (as a smpl loop chunk) and M4A.',
              ]
            : []),
          '\n   Loop tags: '
        )
      )
    )
      .trim()
      .toLowerCase();

    let mode: LoopDataMode | null = null;
    if (answer === '' || answer === 'keep' || answer === 'auto') mode = 'auto';
    else if (answer === 'skip' || answer === 's') mode = 'skip';
    else if (offerForce && (answer === 'force' || answer === 'f'))
      mode = 'force';

    if (!mode) {
      logger.warn(
        `\n⚠️ Please leave blank, or type "skip"${offerForce ? ' or "force"' : ''}.`
      );
      continue;
    }

    const label =
      mode === 'auto'
        ? 'keep where supported'
        : mode === 'skip'
          ? 'skip'
          : 'write to every format';
    logger.log(chalk.green.italic(`\n ✨ Loop tags: ${label} ✅`));
    return mode;
  }
};

export const getRelativeOutputDir = (
  inputRoot: string,
  inputFile: string
): string => {
  const normalizedRoot = resolve(inputRoot);
  const normalizedFile = resolve(inputFile);
  const relFilePath = relative(normalizedRoot, normalizedFile);
  const relDir = dirname(relFilePath);

  if (relDir === '.' || relDir === '') {
    return '';
  }

  // Guard against writing outside output root if paths are inconsistent.
  // (A folder merely *named* "..something" is fine — only a real ".." segment escapes.)
  if (
    relDir === '..' ||
    relDir.startsWith('../') ||
    relDir.startsWith('..\\') ||
    isAbsolute(relDir)
  ) {
    logger.warn(
      `Could not preserve folder structure for ${inputFile}; falling back to output root.`
    );
    return '';
  }

  return relDir;
};

/**
 * Normalized path key for O(1) output conflict lookups. Resolves symlinked or
 * aliased folders (so an output folder that is really the input folder can't
 * overwrite inputs) and always folds case (see pathKey.ts for why).
 */
export const normalizeOutputPathKey = (filePath: string): string =>
  pathKey(filePath);

/** Walk root once and collect existing file paths (avoids per-output existsSync). */
export const scanExistingFiles = (rootPath: string): Set<string> => {
  const found = new Set<string>();
  // Folders already walked (by real path) so symlink loops can't recurse forever.
  const visited = new Set<string>();

  const walk = (dir: string): void => {
    const real = realPathOr(dir);
    if (visited.has(real)) return;
    visited.add(real);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const name of entries) {
      const fullPath = join(dir, name);
      try {
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
          walk(fullPath);
        } else {
          found.add(normalizeOutputPathKey(fullPath));
        }
      } catch {
        // Unreadable entry — skip and continue the scan.
      }
    }
  };

  walk(rootPath);
  return found;
};

/**
 * Existing files in just the given folders (not their subfolders): the only
 * places this batch can write to. Scanning the whole output root instead
 * would walk an entire drive when the output folder is e.g. `D:\\`.
 */
export const scanExistingFilesIn = (dirs: Iterable<string>): Set<string> => {
  const found = new Set<string>();
  for (const dir of dirs) {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      continue; // Folder doesn't exist yet (or can't be read): nothing to clash with.
    }
    // Subfolders are included on purpose: a folder named like an output
    // blocks that output just as a file would.
    for (const name of names) {
      found.add(normalizeOutputPathKey(join(dir, name)));
    }
  }
  return found;
};

//Create final list of output files to convert
const createConversionList = async (
  files: string[]
): Promise<ConversionItem[]> => {
  let {
    inputFilePath,
    outputFilePath,
    outputFormats,
    oggCodec,
    singleFileMode,
  } = settings;
  let outputFolder: string | null = null;

  // Loop-tag handling is asked per batch too; default to keeping them.
  settings.loopDataMode = 'auto';

  // Choose Vorbis/Opus fresh for each batch that includes OGG output.
  if (outputFormats.includes('ogg')) {
    settings.oggCodec = null;
    oggCodec = null;
  }

  let convertSelf: string | null = null;
  const conversionList: ConversionCandidate[] = [];
  let response: string | null = null;
  let relativePath: string;

  // Batch summary information
  logger.log(chalk.blueBright('\n📝 Conversion parameters:'));
  logger.log(chalk.blueBright(`  Files to process: ${files.length}`));
  logger.log(
    chalk.blueBright(`  Single file mode: ${singleFileMode ? 'Yes' : 'No'}`)
  );
  logger.log(chalk.blueBright(`  Input path: ${inputFilePath}`));
  logger.log(chalk.blueBright(`  Output path: ${outputFilePath}`));
  logger.log(chalk.blueBright(`  Output formats: ${outputFormats.join(', ')}`));

  // Validate we have files to process
  if (!files.length) {
    logger.error(
      chalk.redBright('\n❌ Error: No input files found to process.')
    );
    // Conversion never starts here, so report any search errors now instead of
    // relying on finalize (which won't run in this branch).
    await reportSearchErrors();
    handleExit(1);
  }

  // The folders outputs will be written to: the output folder mirrors the
  // input tree, or (same-folder mode) each input's own folder.
  const outputRoot =
    inputFilePath !== outputFilePath ? outputFilePath : inputFilePath;
  const targetDirs = new Set<string>();
  for (const inputFile of files) {
    try {
      targetDirs.add(
        join(outputRoot, getRelativeOutputDir(inputFilePath, inputFile))
      );
    } catch {
      // Path issues are handled later in the main loop
    }
  }
  const existingOutputs = scanExistingFilesIn(targetDirs);
  const skipConflictChecks = existingOutputs.size === 0;
  const plannedOutputs = new Set<string>();
  // Every input in this batch: an existing output that is also an input must
  // never be overwritten, even after "o"/"oa" (it may not be converted yet).
  const inputKeys = new Set(files.map(normalizeOutputPathKey));
  const isPlannedOutput = (outputFile: string): boolean =>
    plannedOutputs.has(normalizeOutputPathKey(outputFile));
  const outputAlreadyExists = (outputFile: string): boolean =>
    existingOutputs.has(normalizeOutputPathKey(outputFile));

  // Track progress for large batches
  const totalItems = files.length * outputFormats.length;
  let processedCount = 0;
  const showProgress = files.length > 100;
  const showDetailedLogs = files.length <= 20; // Only show per-file logs for small batches

  for (const inputFile of files) {
    if (showDetailedLogs) {
      logger.log(chalk.cyan(`\n🔍 Processing input file: ${inputFile}`));
    }

    for (const outputFormat of outputFormats) {
      if (showDetailedLogs) {
        logger.log(chalk.cyan(`  🔄 Output format: ${outputFormat}`));
      }

      let action: ConversionCandidate['action'] = 'convert';
      let outputFile: string;
      if (outputFormats.includes('ogg') && !oggCodec) {
        oggCodec = await askOggCodec();
      }

      outputFile = `${join(
        dirname(inputFile),
        basename(inputFile, extname(inputFile))
      )}.${outputFormat}`;

      // Calculate relative path if needed
      try {
        relativePath = getRelativeOutputDir(inputFilePath, inputFile);
      } catch (error) {
        logger.error(
          chalk.redBright(
            `❌ Error calculating relative path: ${getErrorMessage(error)}`
          )
        );
        relativePath = '';
      }

      if (inputFilePath !== outputFilePath) {
        outputFolder = join(outputFilePath, relativePath);
        outputFile = join(
          outputFolder,
          `${basename(inputFile, extname(inputFile))}.${outputFormat}`
        );
        // Directories already created in batch above
      } else {
        outputFolder = join(inputFilePath, relativePath);
      }

      // Show progress for large batches (update every 1000 items)
      processedCount++;
      if (showProgress && processedCount % 1000 === 0) {
        process.stdout.write(
          `\r   Building list: ${processedCount}/${totalItems} items...`
        );
      }

      if (showDetailedLogs) {
        logger.log(chalk.cyan(`  📁 Output folder: ${outputFolder}`));
        logger.log(chalk.cyan(`  📄 Output file: ${outputFile}`));
      }

      // Stops from overwriting input file.
      // resolve() normalises .., ./, trailing slashes, and relative vs absolute.
      if (
        normalizeOutputPathKey(inputFile) === normalizeOutputPathKey(outputFile)
      ) {
        logger.log(
          chalk.yellow(
            `  ⚠️ Input file and output file are the same: ${inputFile}`
          )
        );

        while (true) {
          if (
            convertSelf === '' ||
            (convertSelf && /^no$/i.test(convertSelf))
          ) {
            logger.log('\n 🚫 Not converting files to own type! 🚫 \n');
            convertSelf = 'no';
            action = 'skip';
            break;
          }
          if (convertSelf && /^yes$/i.test(convertSelf)) {
            convertSelf = 'yes';
            logger.log('\n 🔀 Converting files to own type! ✔');
            //Rename. Never overwrite input file.
            outputFile = await getOutputFileCopy(
              inputFile,
              outputFormat,
              outputFolder || dirname(inputFile),
              isPlannedOutput
            );
            break;
          }
          convertSelf = (
            await getAnswer(
              chalk.blueBright(
                '\n 👋 Would you like to convert to the same file type?\n Useful for compressing existing files.\n Don\'t worry - your original files will not be overwritten.\n They\'ll be renamed automatically (e.g., file.ogg --> file-copy(1).ogg).\n\n Type "yes" or "no": '
              )
            )
          )
            .trim()
            .toLowerCase();
          if (
            convertSelf !== '' &&
            convertSelf !== 'yes' &&
            convertSelf !== 'no'
          ) {
            logger.warn('⚠️  Invalid input, please type "yes" or "no" ⚠️');
          }
        }
      }

      const responseActions: { [key: string]: () => Promise<void> } = {
        o: async () => {
          response = null;
        },
        oa: async () => {
          if (!outputAlreadyExists(outputFile)) return;
          /* Nothing to do as default is overwrite */
          // ffmpeg will overwrite the file without asking if this is messed up.
        },
        r: async () => {
          outputFile = await getOutputFileCopy(
            inputFile,
            outputFormat,
            outputFolder || dirname(inputFile),
            isPlannedOutput
          );
          action = 'convert';
          response = null;
        },
        ra: async () => {
          // A name another input in this batch already claimed is a conflict
          // too; renaming beats silently dropping this input later.
          if (!outputAlreadyExists(outputFile) && !isPlannedOutput(outputFile))
            return;
          outputFile = await getOutputFileCopy(
            outputFile,
            outputFormat,
            outputFolder || dirname(outputFile),
            isPlannedOutput
          );
          action = 'convert';
        },
        s: async () => {
          action = 'skip';
          response = null;
        },
        sa: async () => {
          if (!outputAlreadyExists(outputFile)) return;
          action = 'skip';
        },
      };

      // Handle file exists responses. Skip entirely when this item is already
      // skipped (e.g. user declined same-type conversion) — otherwise a rename
      // answer here or a prior "ra" would flip it back to 'convert'.
      if (action !== 'skip') {
        switch (response) {
          case '':
            logger.error('response was empty:', response);
            break;
          case 'ra':
            await responseActions['ra']?.();
            break;
          case 'sa':
            await responseActions['sa']?.();
            break;
          case 'oa':
            if (outputAlreadyExists(outputFile)) {
              logger.log(
                chalk.red('🔺🚩OVERWRITE FILE🚩'),
                chalk.yellow(outputFile, ' 🔺')
              );
            }
            break;
          default:
            while (true) {
              if (!response) {
                if (!skipConflictChecks && outputAlreadyExists(outputFile)) {
                  logger.log(
                    chalk.red.bold(`\n🚨 ${outputFile} 🤔 already exists!`)
                  );

                  response = await getAnswer(
                    chalk.blue.bold(
                      `\n[O]verwrite, [R]ename or [S]kip? 👀 Add 'a' for all (e.g., oa, ra, sa)`
                    )
                  );
                  response = response ? response.trim().toLowerCase() : '';

                  if (response && responseActions[response]) {
                    await responseActions[response]?.();
                    break;
                  } else {
                    response = null;
                    logger.warn('\n⚠️ Invalid selection! Try again ⚠️');
                  }
                } else {
                  break;
                }
              }
            }
        }
      }

      if (
        action === 'convert' &&
        inputKeys.has(normalizeOutputPathKey(outputFile))
      ) {
        logger.warn(
          chalk.yellow(
            `⚠️  ${outputFile} is one of your input files — renaming the output instead of overwriting it.`
          )
        );
        outputFile = await getOutputFileCopy(
          outputFile,
          outputFormat,
          outputFolder || dirname(outputFile),
          isPlannedOutput
        );
      }

      if (action === 'convert') {
        plannedOutputs.add(normalizeOutputPathKey(outputFile));
      }

      // Add to conversion list
      conversionList.push({
        inputFile,
        outputFile,
        outputFormat,
        action,
      });

      if (showDetailedLogs) {
        logger.log(
          chalk.green(
            `  ✅ Added to conversion list: ${inputFile} -> ${outputFile}`
          )
        );
      }
    }
  }

  // Clear progress line and show completion
  if (showProgress) {
    process.stdout.write(
      `\r   Building list: ${totalItems}/${totalItems} items... Done!\n`
    );
  }

  // Ask how to handle loop tags only when an input actually has some.
  const toConvert = conversionList.filter((x) => x.action === 'convert');
  if (toConvert.length > 0) {
    const loopFile = findLoopTaggedFile(
      new Set(toConvert.map((x) => x.inputFile))
    );
    if (loopFile) {
      settings.loopDataMode = await askLoopDataMode(
        loopFile,
        toConvert.some(
          (x) => x.outputFormat === 'wav' || x.outputFormat === 'm4a'
        )
      );
    }
  }

  // Process the conversion list
  while (true) {
    // Function to remove duplicates based on outputFile.
    // Two different inputs can resolve to the same output path (e.g. song.wav
    // and song.flac from different folders both targeting /out/song.mp3). We
    // keep the first and warn so the dropped input isn't lost silently.
    const removeDuplicates = (
      list: ConversionCandidate[]
    ): ConversionCandidate[] => {
      const seen = new Map<string, string>();
      return list.filter((conversion: ConversionCandidate) => {
        const key = normalizeOutputPathKey(conversion.outputFile);
        const firstInput = seen.get(key);
        if (firstInput !== undefined) {
          logger.warn(
            chalk.yellow(
              `⚠️  Skipping duplicate output: "${conversion.outputFile}" would be produced by both "${firstInput}" and "${conversion.inputFile}". Keeping the first.`
            )
          );
          return false;
        }
        seen.set(key, conversion.inputFile);
        return true;
      });
    };

    const uniqueConversionList = removeDuplicates(
      conversionList.filter((x: ConversionCandidate) => x.action === 'convert')
    );

    const filesToConvert: ConversionItem[] = uniqueConversionList.map(
      ({ inputFile, outputFile, outputFormat }: ConversionCandidate) => ({
        inputFile,
        outputFile,
        outputFormat,
      })
    );

    // Display conversion list - only build numbered array for what we show
    const MAX_DISPLAY = 20;
    const fileCount = filesToConvert.length;

    if (fileCount > 200) {
      // For large lists, only number the first few
      const preview = filesToConvert
        .slice(0, MAX_DISPLAY)
        .map((x: ConversionItem, i: number) => `🔊 ${i + 1} ${x.outputFile}`);
      logger.log(
        chalk.cyanBright(
          '\n🔄 Pending Conversion 🔄',
          fileCount,
          'Output Files \n\n',
          preview.join('\n'),
          chalk.gray(`\n    ... and ${fileCount - MAX_DISPLAY} more files`)
        )
      );
    } else {
      const numbered = filesToConvert.map(
        (x: ConversionItem, index: number) => `🔊 ${index + 1} ${x.outputFile}`
      );
      logger.log(
        chalk.cyanBright(
          '\n🔄 Pending Conversion 🔄',
          fileCount,
          'Output Files \n\n',
          numbered.join('\n')
        )
      );
    }

    // No files to convert
    if (fileCount === 0) {
      logger.log(
        chalk.yellow('\n⚠️ No files to convert after filtering! Exiting.')
      );
      handleExit(0);
    }

    // Final confirmation
    const accept_answer = await getAnswer(
      chalk.blueBright(
        '\n✏️ This is the list of files to be converted. Start now? Type "yes" ✅ or "no" ❌:  '
      )
    );

    const accepted = accept_answer.trim();
    if (/^no?$/i.test(accepted)) {
      logger.log('\n🚫 Conversion cancelled. Restarting program 🚫');
      handleExit(0);
    } else if (!/^y(es)?$/i.test(accepted)) {
      logger.warn('\n⚠️  Invalid input, please type "yes" or "no" ⚠️');
      continue;
    }

    // Create output folders only now that the user has said yes, and only
    // for files that will actually be written.
    const outputDirs = new Set(
      filesToConvert.map((f) => dirname(f.outputFile))
    );
    for (const dir of outputDirs) {
      if (!existsSync(dir)) {
        try {
          mkdirSync(dir, { recursive: true });
        } catch (error) {
          logger.error(
            chalk.redBright.bold("Couldn't create directory:", dir),
            error
          );
        }
      }
    }

    return filesToConvert;
  }
};

export default createConversionList;
