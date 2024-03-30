const { existsSync } = require("fs");
const { join, basename, extname, dirname } = require("path");
const chalk = require("chalk");
const { getAnswer, settings } = require("./utils");

//Create final list of files to convert by asking user for each conflicting file
const createConversionList = async (files) => {
  const { filePath, outputFilePath } = settings;
  // console.log("settings", filePath, outputFilePath);
  let convertSelf;
  const conversionList = [];
  let response = null;
  for (const inputFile of files) {
    for (const outputFormat of settings.outputFormats) {
      let outputFile = `${join(
        dirname(inputFile),
        basename(inputFile, extname(inputFile))
      )}.${outputFormat}`;

      let outputFileCopy = `${join(
        dirname(inputFile),
        `${basename(inputFile, extname(inputFile))}-copy(1)`
      )}.${outputFormat}`;

      if (filePath != outputFilePath) {
        outputFile = `${join(
          outputFilePath,
          `${basename(inputFile, extname(inputFile))}`
        )}.${outputFormat}`;
        conversionList.push({
          inputFile,
          outputFile,
          outputFormat,
        });
        continue;
      }
      //yes, both checks are required
      if (
        inputFile === outputFile ||
        inputFile.toLowerCase() === outputFile.toLowerCase()
      ) {
        if (convertSelf === "yes") {
          outputFile = `${join(
            dirname(inputFile),
            `${basename(inputFile, extname(inputFile))}-copy(1)`
          )}.${outputFormat}`;
        } else if (convertSelf === "no") {
          continue;
        } else {
          while (!convertSelf) {
            convertSelf = await getAnswer(
              chalk.blueBright(
                '\n Would you like to convert to same file type? ie ogg to ogg... Type "yes" ✅ or "no" ❌:  '
              )
            );

            if (/^no$/i.test(convertSelf)) {
              console.log("🚫 Not converting files to own type! 🚫");
              convertSelf = "no";
              continue;
            }
            if (!/^yes$/i.test(convertSelf)) {
              console.warn('⚠️ Invalid input, please type "yes" or "no" ⚠️');
            }
            if (/^yes$/i.test(convertSelf)) {
              outputFile = `${join(
                dirname(inputFile),
                `${basename(inputFile, extname(inputFile))}-copy(1)`
              )}.${outputFormat}`;
            }
          }
        }
      }

      const responseActions = {
        o: () => {
          return (response = null);
        },
        oa: () => {
          if (!existsSync(outputFile)) return;
          /* Nothing to do as default is overwrite */
        },
        r: () => {
          outputFile = outputFileCopy;
          return (response = null);
        },
        ra: () => {
          if (!existsSync(outputFile)) return;
          outputFile = outputFileCopy;
        },
        s: () => {
          outputFile = "skipped! ⏭️";
          return (response = null);
        },
        sa: () => {
          if (!existsSync(outputFile)) return;
          outputFile = "skipped! ⏭️";
        },
      };
      switch (response) {
        case "":
          console.error("response was empty:", response);
          break;
        case "ra":
          responseActions["ra"]();
          break;
        case "sa":
          responseActions["sa"]();
          break;
        case "oa":
          console.log(
            chalk.red("🔺🚩OVERWRITE FILE🚩"),
            chalk.yellow(outputFile, "🔺")
          );
          break;
        default:
          while (true) {
            if (!response) {
              if (existsSync(outputFile)) {
                console.warn(`${outputFile} already exists!`);
                response = await getAnswer(
                  chalk.blue.bold(
                    `\n[O]verwrite, [R]ename or [S]kip? 👀 Add 'a' for all (e.g., oa, ra, sa)`
                  )
                );
                response = response.trim().toLowerCase();

                if (responseActions[response]) {
                  responseActions[response]();
                  break;
                } else {
                  response = null;
                  console.warn("\n⚠️Invalid selection! Try again⚠️");
                }
              } else {
                //console.warn(outputFile);
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
    const numbered = conversionList.map(
      (x, index) => `🔊 ${index + 1} ${x.outputFile}`
    );
    console.log(
      chalk.cyanBright(
        "\n🔄 Pending Conversion 🔄",
        conversionList.length,
        " Output Files\n",
        numbered.join("\n")
      )
    );
    const accept_answer = await getAnswer(
      chalk.blueBright(
        '\n✏️ This is the list of files to be converted. Accept? Type "yes" ✅ or "no" ❌:  '
      )
    );

    if (/^no$/i.test(accept_answer)) {
      console.log("🚫 Conversion cancelled. Exiting program 🚫");
      process.exit(0);
    }
    if (!/^yes$/i.test(accept_answer)) {
      console.warn('⚠️ Invalid input, please type "yes" or "no" ⚠️');
      continue;
    }
    return conversionList.filter((x) => x.outputFile !== "skipped! ⏭️");
  }
};
module.exports = createConversionList;
