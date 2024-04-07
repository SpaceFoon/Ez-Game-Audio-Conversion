const { existsSync, mkdirSync } = require("fs");
const { join, basename, extname, dirname } = require("path");
const chalk = require("chalk");
const { getAnswer, settings } = require("./utils");
const { Console } = require("console");

const getOutputFileCopy = async (
  inputFile,
  outputFormat,
  outputFolder,
  copyNumber = 1
) => {
  //This function for if file exists and needs to be renamed.

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
  //D:\Music\ALL THAT REMAINS - DISCOGRAPHY (1998-15) [CHANNEL NEO]\[1998] All That Remains (Demos)
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

const askOggCodec = async (oggCodec) => {
  //Choose codec for OGG
  oggCodec = settings.oggCodec;
  const userResponse = await getAnswer(
    chalk.blue.bold(
      "\n🔊 Which codec would you like to use for Ogg files? 🎼 Vorbis or Opus?",
      "\n🎵 Note: Opus is better 💪 but Vorbis works with more game engines. 🎮 🚗",
      "\n\n💡 If you don't want to worry about it, 📝 Leave blank for Vorbis: "
    )
  );
  oggCodec = userResponse.trim().toLowerCase();

  if (oggCodec === "") oggCodec = "vorbis";
  if (oggCodec !== "vorbis" && oggCodec !== "opus") {
    console.warn("\n⚠️ Did not enter Vorbis or Opus! 😧😓😯");
    await askOggCodec(); // Keep asking until a valid input is provided
  } else {
    settings.oggCodec = oggCodec;
    console.log(
      chalk.green.italic(`\n ✨ Ogg Codec 🔌 Selected: ${oggCodec} ✅`)
    );
    return oggCodec;
  }
};

//Create final list of output files to convert
const createConversionList = async (files) => {
  // files.reverse();
  let { inputFilePath, outputFilePath, outputFormats, oggCodec } = settings;
  let outputFolder = null;

  let convertSelf = null;
  const conversionList = [];
  let response = null;
  let relativePath = null;
  for (const inputFile of files) {
    for (const outputFormat of outputFormats) {
      let outputFile = null;
      if (outputFormats.includes("ogg") && !oggCodec) {
        oggCodec = await askOggCodec();
      }

      outputFile = `${join(
        dirname(inputFile),
        basename(inputFile, extname(inputFile))
      )}.${outputFormat}`;
      relativePath = dirname(inputFile.substring(inputFilePath.length));
      if (inputFilePath !== outputFilePath) {
        outputFolder = join(outputFilePath, relativePath);
        outputFile = join(
          outputFolder,
          `${basename(inputFile, extname(inputFile))}.${outputFormat}`
        );
        if (!existsSync(outputFolder)) {
          try {
            mkdirSync(outputFolder, { recursive: true });
          } catch (error) {
            console.error(
              chalk.redBright.bold("Couldn't create directory, check folder"),
              error
            );
          }
        }
      } else {
        outputFolder = join(inputFilePath, relativePath);
      }

      //Stop from overwriting input file
      //yes, both checks are required, no idea why
      if (
        inputFile.toLowerCase() === outputFile.toLowerCase() ||
        inputFile === outputFile
      )
        while (true) {
          if (convertSelf === "" || /^no$/i.test(convertSelf)) {
            console.log("\n 🚫 Not converting files to own type! 🚫");
            convertSelf = "no";
            outputFile = `${outputFile} "Skipped! ⏭️!"`;
            break;
          }
          if (/^yes$/i.test(convertSelf)) {
            convertSelf = "yes";
            console.log("\n 🔀 Converting files to own type! ✔");
            outputFile = await getOutputFileCopy(
              inputFile,
              outputFormat,
              outputFolder
            );
            break;
          }
          convertSelf = await getAnswer(
            chalk.blueBright(
              '\n 👋❔ Would you like to convert to same file type? ie ogg to ogg... Type "yes" ✅ or "no" ❌:  '
            )
          );
          if (
            convertSelf !== "" ||
            convertSelf !== "yes" ||
            convertSelf !== "no"
          ) {
            console.warn('⚠️  Invalid input, please type "yes" or "no" ⚠️');
          }
        }
      // }
      //}//

      const responseActions = {
        o: async () => {
          return (response = null);
        },
        oa: async () => {
          if (!existsSync(outputFile)) return;
          /* Nothing to do as default is overwrite */
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
      conversionList.push({
        inputFile,
        outputFile,
        outputFormat,
      });
    }
  }
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
    const numbered = await uniqueConversionList.map(
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
    const accept_answer = await getAnswer(
      chalk.blueBright(
        '\n✏️ This is the list of files to be converted. Accept? Type "yes" ✅ or "no" ❌:  '
      )
    );

    if (/^no$/i.test(accept_answer)) {
      console.log("\n🚫 Conversion cancelled. Exiting program 🚫");
      process.exit(0);
    } else if (!/^yes$/i.test(accept_answer)) {
      console.warn('\n⚠️  Invalid input, please type "yes" or "no" ⚠️');
      continue;
    }
    return uniqueConversionList.filter(
      (x) => !/Skipped!.*⏭️/g.test(x.outputFile)
    );
  }
};
module.exports = createConversionList;
