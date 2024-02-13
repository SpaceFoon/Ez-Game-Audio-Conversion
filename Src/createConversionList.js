const { existsSync } = require("fs");
const { join, basename, extname, dirname, normalize } = require("path");
const chalk = require("chalk");
const { getAnswer, settings } = require("./utils");

//Create final list of files to convert by asking user for each conflicting file
const createConversionList = async (files) => {
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
        `${basename(inputFile, extname(inputFile))} copy (1)`
      )}.${outputFormat}`;

      //yes these are both required
      if (inputFile == outputFile) {
        continue;
      }
      if (inputFile.toLowerCase() === outputFile.toLowerCase()) {
        continue;
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
        "\n🔄 Pending conversion 🔄",
        conversionList.length,
        "files\n",
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
