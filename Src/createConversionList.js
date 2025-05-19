const { existsSync, mkdirSync } = require("fs");
const { join, basename, extname, dirname } = require("path");
const chalk = require("chalk");
const { getAnswer, settings, handleExit } = require("./utils");

// Get a unique output file name
const getOutputFileCopy = async (
  inputFile,
  outputFormat,
  outputFolder,
  copyNumber = 1
) => {
  let baseNameCopy = basename(inputFile, extname(inputFile));
  let match = baseNameCopy.match(/^(.+)-copy\((\d+)\)/);

  if (match) {
    baseNameCopy = match[1];
    copyNumber = parseInt(match[2], [10]);
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

const askOggCodec = async () => {
  //Choose codec for OGG
  const userResponse = await getAnswer(
    chalk.blue.bold(
      "\n🔊 Which codec would you like to use for Ogg files? 🎼 Vorbis or Opus?",
      "\n🎵 Note: Opus is better 💪 but Vorbis works with more game engines. 🎮 🚗",
      "\n\n💡 If you are unsure, leave blank for Vorbis: "
    )
  );

  // Process the user input
  const input = userResponse.trim().toLowerCase();

  if (input === "") return "vorbis";
  if (input !== "vorbis" && input !== "opus") {
    console.warn("\n⚠️ Did not enter Vorbis or Opus! 😧😓😯");
    return await askOggCodec(); // Keep asking until a valid input is provided
  }

  // Save the selection to settings and return
  settings.oggCodec = input;
  console.log(chalk.green.italic(`\n ✨ Ogg Codec 🔌 Selected: ${input} ✅`));
  return input;
};

//Create final list of output files to convert
const createConversionList = async (files) => {
  let {
    inputFilePath,
    outputFilePath,
    outputFormats,
    oggCodec,
    singleFileMode,
  } = settings;
  let outputFolder = null;

  let convertSelf = null;
  const conversionList = [];
  let response = null;
  let relativePath = null;

  // Ensure we have the ogg codec set
  if (!settings.oggCodec) {
    settings.oggCodec = "vorbis";
  }

  // Debug information
  console.log(chalk.blueBright("\n📝 Conversion parameters:"));
  console.log(chalk.blueBright(`  Files to process: ${files.length}`));
  console.log(
    chalk.blueBright(`  Single file mode: ${singleFileMode ? "Yes" : "No"}`)
  );
  console.log(chalk.blueBright(`  Input path: ${inputFilePath}`));
  console.log(chalk.blueBright(`  Output path: ${outputFilePath}`));
  console.log(
    chalk.blueBright(`  Output formats: ${outputFormats.join(", ")}`)
  );

  // Validate we have files to process
  if (!files.length) {
    console.error(
      chalk.redBright("\n❌ Error: No input files found to process.")
    );
    handleExit(1);
  }

  for (const inputFile of files) {
    // Debug the input file
    console.log(chalk.cyan(`\n🔍 Processing input file: ${inputFile}`));

    for (const outputFormat of outputFormats) {
      console.log(chalk.cyan(`  🔄 Output format: ${outputFormat}`));

      let outputFile = null;
      if (outputFormats.includes("ogg") && !oggCodec) {
        oggCodec = await askOggCodec();
      }

      outputFile = `${join(
        dirname(inputFile),
        basename(inputFile, extname(inputFile))
      )}.${outputFormat}`;

      // Calculate relative path if needed
      try {
        relativePath = dirname(inputFile.substring(inputFilePath.length));
      } catch (error) {
        console.error(
          chalk.redBright(
            `❌ Error calculating relative path: ${error.message}`
          )
        );
        relativePath = "";
      }

      if (inputFilePath !== outputFilePath) {
        outputFolder = join(outputFilePath, relativePath);
        outputFile = join(
          outputFolder,
          `${basename(inputFile, extname(inputFile))}.${outputFormat}`
        );

        // Create output directory if needed
        if (!existsSync(outputFolder)) {
          try {
            mkdirSync(outputFolder, { recursive: true });
          } catch (error) {
            console.error(
              chalk.redBright.bold("Couldn't create directory, check folder"),
              error
            );
            handleExit(1);
          }
        }
      } else {
        outputFolder = join(inputFilePath, relativePath);
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
          if (convertSelf === "" || /^no$/i.test(convertSelf)) {
            console.log("\n 🚫 Not converting files to own type! 🚫 \n");
            convertSelf = "no";
            outputFile = `${outputFile} "Skipped! ⏭️!"`;
            break;
          }
          if (/^yes$/i.test(convertSelf)) {
            convertSelf = "yes";
            console.log("\n 🔀 Converting files to own type! ✔");
            //Rename. Never overwrite input file.
            outputFile = await getOutputFileCopy(
              inputFile,
              outputFormat,
              outputFolder
            );
            break;
          }
          convertSelf = await getAnswer(
            chalk.blueBright(
              '\n 👋 Would you like to convert to the same file type?\n Useful for compressing existing files.\n Don\'t worry - your original files will not be overwritten.\n They\'ll be renamed automatically (e.g., file.ogg --> file(1).ogg).\n\n Type "yes" or "no": '
            )
          );
          if (
            convertSelf !== "" &&
            convertSelf !== "yes" &&
            convertSelf !== "no"
          ) {
            console.warn('⚠️  Invalid input, please type "yes" or "no" ⚠️');
          }
        }
      }

      const responseActions = {
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
            outputFolder
          );
          return (response = null);
        },
        ra: async () => {
          if (!existsSync(outputFile)) return;
          outputFile = await getOutputFileCopy(
            outputFile,
            outputFormat,
            outputFolder
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
        case "":
          console.error("response was empty:", response);
          break;
        case "ra":
          await responseActions["ra"]();
          break;
        case "sa":
          await responseActions["sa"]();
          break;
        case "oa":
          console.log(
            chalk.red("🔺🚩OVERWRITE FILE🚩"),
            chalk.yellow(outputFile, " 🔺")
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
                response = await response.trim().toLowerCase();

                if (await responseActions[response]) {
                  await responseActions[response]();
                  break;
                } else {
                  response = null;
                  console.warn("\n⚠️ Invalid selection! Try again ⚠️");
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

  // Process the conversion list
  while (true) {
    // Function to remove duplicates based on outputFile
    const removeDuplicates = async (conversionList) => {
      const seen = new Set();
      return conversionList.filter((conversion) => {
        const duplicate = seen.has(conversion.outputFile);
        seen.add(conversion.outputFile);
        return !duplicate;
      });
    };

    const uniqueConversionList = await removeDuplicates(conversionList);

    // Filter out skipped files
    const filesToConvert = uniqueConversionList.filter(
      (x) => !/Skipped!.*⏭️/g.test(x.outputFile)
    );

    // Display conversion list
    const numbered = await filesToConvert.map(
      (x, index) => `🔊 ${index + 1} ${x.outputFile}`
    );

    console.log(
      chalk.cyanBright(
        "\n🔄 Pending Conversion 🔄",
        numbered.length,
        "Output Files \n\n",
        numbered.join("\n")
      )
    );

    // No files to convert
    if (numbered.length === 0) {
      console.log(
        chalk.yellow("\n⚠️ No files to convert after filtering! Exiting.")
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
      console.log("\n🚫 Conversion cancelled. Exiting program 🚫");
      handleExit(0);
    } else if (!/^yes$/i.test(accept_answer)) {
      console.warn('\n⚠️  Invalid input, please type "yes" or "no" ⚠️');
      continue;
    }

    return filesToConvert;
  }
};

module.exports = createConversionList;
