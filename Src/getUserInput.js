const { existsSync, mkdirSync } = require("fs");
const chalk = require("chalk");
const { rl, checkDiskSpace } = require("./utils");

//Starts with user input
const getUserInput = (settings) => {
  return new Promise((resolve) => {
    const askInputPath = () => {
      rl.question(
        chalk.blue.bold(
          "\n 📁 Choose the folder to search for files to convert. ",
          "\n 🔍 This will recursively search, ie: all subfolders ",
          "\n 🐭 Right-click to paste. ",
          "\n ✏️  Input Folder Path: "
        ),
        (inputFilePath) => {
          if (!existsSync(inputFilePath)) {
            console.warn("\n⚠️ File Path does not exist! 🤣😊😂");
            askInputPath();
          } else {
            settings.inputFilePath = inputFilePath;
            console.log(
              chalk.green.italic(
                `\n📝 Input Filepath: ${settings.inputFilePath} ✅`
              )
            );
            askOutputPath(inputFilePath);
          }
        }
      );
    };
    const askOutputPath = (inputFilePath) => {
      rl.question(
        chalk.blue.bold(
          "\n✏️  Enter the output filepath. 🚨 Leave blank for same folder as input files 📂:"
        ),
        (outputFilePath) => {
          if (outputFilePath === "") outputFilePath = inputFilePath;

          if (!existsSync(outputFilePath)) {
            console.warn(
              "\n⚠️ File Path does not exist! 👨‍🏭 Creating folder... 🚧"
            );
            try {
              mkdirSync(outputFilePath, { recursive: true });
            } catch {
              console.error("Failed to make folder at:", outputFilePath);
              setTimeout(() => {}, 200);
              askOutputPath();
            }
            askInputFormats();
          }
          settings.outputFilePath = outputFilePath;
          console.log(
            chalk.green.italic(`\n📝 Output Filepath: ${outputFilePath} ✅`)
          );
          // Log disk space but don't interrupt user input on failure
          checkDiskSpace(outputFilePath).catch(() => {});
          askInputFormats();
        }
      );
    };

    const askInputFormats = () => {
      rl.question(
        chalk.blue.bold(
          "\n✏️  Enter the file extensions to look for. Leave blank for all 🚨 (e.g., ogg, mp3, m4a, wav, aiff, flac): "
        ),
        (inputFormatString) => {
          settings.inputFormats = inputFormatString
            ? inputFormatString
                .toLowerCase()
                .split(/\s*,\s*|\s+/)
                .map((format) => format.trim())
            : ["flac", "aiff", "wav", "mp3", "m4a", "ogg", "midi"];
          if (
            settings.inputFormats.length === 0 ||
            !settings.inputFormats.every((format) =>
              [
                "flac",
                "aiff",
                "wav",
                "mp3",
                "m4a",
                "ogg",
                "midi",
                "mid",
              ].includes(format)
            )
          ) {
            console.warn(
              "\n🛑🙊Invalid input format🙈🛑\n⚠️Only ogg, mp3, m4a, wav, aiff and flac are allowed"
            );
            askInputFormats();
          } else {
            console.log(
              chalk.green.italic(
                `\n📝 Input formats: ${settings.inputFormats
                  .map((el) => el + "✅ ")
                  .join("")}`
              )
            );
            askOutputFormats();
          }
        }
      );
    };

    const askOutputFormats = () => {
      rl.question(
        chalk.blue.bold(
          "\n✏️  Enter the output formats. Leave blank for all 🚨 (e.g., ogg, mp3, m4a, wav, aiff, flac): "
        ),
        (outputFormatString) => {
          settings.outputFormats = outputFormatString
            ? outputFormatString.toLowerCase().split(" ")
            : ["flac", "aiff", "wav", "mp3", "m4a", "ogg"];
          if (
            settings.outputFormats.length === 0 ||
            !settings.outputFormats.every((format) =>
              ["flac", "aiff", "wav", "mp3", "m4a", "ogg"].includes(format)
            )
          ) {
            console.warn(
              "\n🛑🙊Invalid output format🙈🛑\n⚠️Only ogg, mp3, m4a, wav, aiff and flac are allowed!"
            );
            askOutputFormats();
          } else {
            console.log(
              chalk.green.italic(
                `\n📝 Output formats: ${settings.outputFormats
                  .map((el) => el + "✅ ")
                  .join("")}`
              )
            );
            resolve(settings);
          }
        }
      );
    };

    askInputPath();
  });
};
module.exports = getUserInput;
