import { existsSync, mkdirSync } from 'fs';
import { join, basename, extname, dirname, relative } from 'path';
import chalk from 'chalk';
import { getAnswer, settings, handleExit } from './utils.js';
import type { AudioFormat, ConversionItem, OggCodec } from './types/audio.js';

// Get a unique output file name
const getOutputFileCopy = async (
  inputFile: string,
  outputFormat: AudioFormat,
  outputFolder: string,
  copyNumber: number = 1
): Promise<string> => {
  let baseNameCopy = basename(inputFile, extname(inputFile));
  let match = baseNameCopy.match(/^(.+)-copy\((\d+)\)/);

  if (match && match[1] && match[2]) {
    baseNameCopy = match[1];
    copyNumber = parseInt(match[2], 10);
    copyNumber++;
  }
  let outputFileCopy = `${join(
    outputFolder,
    `${baseNameCopy}-copy(${copyNumber})`
  )}.${outputFormat}`;
  if (existsSync(outputFileCopy)) {
    outputFileCopy = await getOutputFileCopy(
      outputFileCopy,
      outputFormat,
      outputFolder,
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

  if (input === '') return 'vorbis';
  if (input !== 'vorbis' && input !== 'opus') {
    console.warn('\n⚠️ Did not enter Vorbis or Opus! 😧😓😯');
    return await askOggCodec(); // Keep asking until a valid input is provided
  }

  // Save the selection to settings and return
  settings.oggCodec = input;
  console.log(chalk.green.italic(`\n ✨ Ogg Codec 🔌 Selected: ${input} ✅`));
  return input;
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

  let convertSelf: string | null = null;
  const conversionList: ConversionItem[] = [];
  let response: string | null = null;
  let relativePath: string | null = null;

  // Ensure we have the ogg codec set
  if (!settings.oggCodec) {
    settings.oggCodec = 'vorbis';
  }

  // Debug information
  console.log(chalk.blueBright('\n📝 Conversion parameters:'));
  console.log(chalk.blueBright(`  Files to process: ${files.length}`));
  console.log(
    chalk.blueBright(`  Single file mode: ${singleFileMode ? 'Yes' : 'No'}`)
  );
  console.log(chalk.blueBright(`  Input path: ${inputFilePath}`));
  console.log(chalk.blueBright(`  Output path: ${outputFilePath}`));
  console.log(
    chalk.blueBright(`  Output formats: ${outputFormats.join(', ')}`)
  );

  // Validate we have files to process
  if (!files.length) {
    console.error(
      chalk.redBright('\n❌ Error: No input files found to process.')
    );
    handleExit(1);
  }

  // Pre-calculate and create all unique output directories ONCE
  // This avoids 180k+ existsSync calls (30k files × 6 formats)
  if (inputFilePath !== outputFilePath) {
    console.log(chalk.cyan('\n📁 Preparing output directories...'));
    const outputDirs = new Set<string>();
    for (const inputFile of files) {
      try {
        const relPath = dirname(relative(inputFilePath, inputFile));
        outputDirs.add(join(outputFilePath, relPath));
      } catch {
        // Will handle errors in main loop
      }
    }
    console.log(chalk.cyan(`   Creating ${outputDirs.size} directories...`));
    for (const dir of outputDirs) {
      if (!existsSync(dir)) {
        try {
          mkdirSync(dir, { recursive: true });
        } catch (error) {
          console.error(
            chalk.redBright.bold("Couldn't create directory:", dir),
            error
          );
        }
      }
    }
    console.log(chalk.green('   ✅ Directories ready'));
  }

  // Track progress for large batches
  const totalItems = files.length * outputFormats.length;
  let processedCount = 0;
  const showProgress = files.length > 100;

  for (const inputFile of files) {
    console.log(chalk.cyan(`\n🔍 Processing input file: ${inputFile}`));

    for (const outputFormat of outputFormats) {
      console.log(chalk.cyan(`  🔄 Output format: ${outputFormat}`));

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
        relativePath = dirname(relative(inputFilePath, inputFile));
      } catch (error) {
        console.error(
          chalk.redBright(
            `❌ Error calculating relative path: ${error instanceof Error ? error.message : String(error)}`
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

      console.log(chalk.cyan(`  📁 Output folder: ${outputFolder}`));
      console.log(chalk.cyan(`  📄 Output file: ${outputFile}`));

      // Stops from overwriting input file.
      // Yes, both checks are required, no idea why..
      if (
        inputFile.toLowerCase() === outputFile.toLowerCase() ||
        inputFile === outputFile
      ) {
        console.log(
          chalk.yellow(
            `  ⚠️ Input file and output file are the same: ${inputFile}`
          )
        );

        while (true) {
          if (
            convertSelf === '' ||
            (convertSelf && /^no$/i.test(convertSelf))
          ) {
            console.log('\n 🚫 Not converting files to own type! 🚫 \n');
            convertSelf = 'no';
            outputFile = `${outputFile} "Skipped! ⏭️!"`;
            break;
          }
          if (convertSelf && /^yes$/i.test(convertSelf)) {
            convertSelf = 'yes';
            console.log('\n 🔀 Converting files to own type! ✔');
            //Rename. Never overwrite input file.
            outputFile = await getOutputFileCopy(
              inputFile,
              outputFormat,
              outputFolder || dirname(inputFile)
            );
            break;
          }
          convertSelf = await getAnswer(
            chalk.blueBright(
              '\n 👋 Would you like to convert to the same file type?\n Useful for compressing existing files.\n Don\'t worry - your original files will not be overwritten.\n They\'ll be renamed automatically (e.g., file.ogg --> file(1).ogg).\n\n Type "yes" or "no": '
            )
          );
          if (
            convertSelf !== '' &&
            convertSelf !== 'yes' &&
            convertSelf !== 'no'
          ) {
            console.warn('⚠️  Invalid input, please type "yes" or "no" ⚠️');
          }
        }
      }

      const responseActions: { [key: string]: () => Promise<void | null> } = {
        o: async () => {
          return (response = null);
        },
        oa: async () => {
          if (!existsSync(outputFile)) return;
          /* Nothing to do as default is overwrite */
          // ffmpeg will overwrite the file without asking if this is messed up.
        },
        r: async () => {
          outputFile = await getOutputFileCopy(
            inputFile,
            outputFormat,
            outputFolder || dirname(inputFile)
          );
          return (response = null);
        },
        ra: async () => {
          if (!existsSync(outputFile)) return;
          outputFile = await getOutputFileCopy(
            outputFile,
            outputFormat,
            outputFolder || dirname(outputFile)
          );
        },
        s: async () => {
          outputFile = `${outputFile} "Skipped! ⏭️"`;
          return (response = null);
        },
        sa: async () => {
          if (!existsSync(outputFile)) return;
          outputFile = `${outputFile} "Skipped! ⏭️"`;
        },
      };

      // Handle file exists responses
      switch (response) {
        case '':
          console.error('response was empty:', response);
          break;
        case 'ra':
          await responseActions['ra']?.();
          break;
        case 'sa':
          await responseActions['sa']?.();
          break;
        case 'oa':
          console.log(
            chalk.red('🔺🚩OVERWRITE FILE🚩'),
            chalk.yellow(outputFile, ' 🔺')
          );
          break;
        default:
          while (true) {
            if (!response) {
              if (existsSync(outputFile)) {
                console.log(
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
                  console.warn('\n⚠️ Invalid selection! Try again ⚠️');
                }
              } else {
                break;
              }
            }
          }
      }

      // Add to conversion list
      conversionList.push({
        inputFile,
        outputFile,
        outputFormat,
      });

      console.log(
        chalk.green(
          `  ✅ Added to conversion list: ${inputFile} -> ${outputFile}`
        )
      );
    }
  }

  // Clear progress line and show completion
  if (showProgress) {
    process.stdout.write(
      `\r   Building list: ${totalItems}/${totalItems} items... Done!\n`
    );
  }

  // Process the conversion list
  while (true) {
    // Function to remove duplicates based on outputFile
    const removeDuplicates = async (conversionList: any[]) => {
      const seen = new Set();
      return conversionList.filter((conversion: any) => {
        const duplicate = seen.has(conversion.outputFile);
        seen.add(conversion.outputFile);
        return !duplicate;
      });
    };

    const uniqueConversionList = await removeDuplicates(conversionList);

    // Filter out skipped files
    const filesToConvert = uniqueConversionList.filter(
      (x: any) => !/Skipped!.*⏭️/g.test(x.outputFile)
    );

    // Display conversion list - only build numbered array for what we show
    const MAX_DISPLAY = 20;
    const fileCount = filesToConvert.length;

    if (fileCount > 200) {
      // For large lists, only number the first few
      const preview = filesToConvert
        .slice(0, MAX_DISPLAY)
        .map((x: any, i: number) => `🔊 ${i + 1} ${x.outputFile}`);
      console.log(
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
        (x: any, index: number) => `🔊 ${index + 1} ${x.outputFile}`
      );
      console.log(
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
      console.log(
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

    if (/^no$/i.test(accept_answer)) {
      console.log('\n🚫 Conversion cancelled. Restarting program 🚫');
      handleExit(0);
    } else if (!/^yes$/i.test(accept_answer)) {
      console.warn('\n⚠️  Invalid input, please type "yes" or "no" ⚠️');
      continue;
    }

    return filesToConvert;
  }
};

export default createConversionList;
