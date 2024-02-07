const { existsSync } = require("fs");
const chalk = require("chalk");
const { rl } = require("./utils");

//Starts with user input
const getUserInput = (settings) => {
  return new Promise((resolve) => {
    const askFilePath = () => {
      rl.question(
        chalk.blue.bold(
          "\n✏️ Enter the full file path to start the search. 🔍 WILL SEARCH ALL SUB FOLDERS 📂: "
        ),
        (filePath) => {
          if (!existsSync(filePath)) {
            console.warn("\n⚠️ File Path does not exist! 🤣😊😂");
            askFilePath();
          } else {
            settings.filePath = filePath;
            console.log(
              chalk.green.italic(`\n📝 File path: ${settings.filePath} ✅`)
            );
            askInputFormats();
          }
        }
      );
    };

    const askInputFormats = () => {
      rl.question(
        chalk.blue.bold(
          "\n✏️ Enter the file extensions to look for. Leave blank for all 🚨 (e.g., flac wav mp3 m4a ogg midi): "
        ),
        (inputFormatString) => {
          settings.inputFormats = inputFormatString
            ? inputFormatString.toLowerCase().split(" ")
            : ["flac", "wav", "mp3", "m4a", "ogg", "midi"];
          if (
            settings.inputFormats.length === 0 ||
            !settings.inputFormats.every((format) =>
              ["flac", "wav", "mp3", "m4a", "ogg", "midi"].includes(format)
            )
          ) {
            console.warn(
              "\n🛑🙊Invalid input format🙈🛑\n⚠️Only flac, wav, mp3, m4a, ogg and midi are allowed"
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
          "\n✏️ Enter the output formats. Leave blank for all 🚨 (e.g., flac ogg mp3 m4a wav): "
        ),
        (outputFormatString) => {
          settings.outputFormats = outputFormatString
            ? outputFormatString.toLowerCase().split(" ")
            : ["flac", "wav", "mp3", "m4a", "ogg"];
          if (
            settings.outputFormats.length === 0 ||
            !settings.outputFormats.every((format) =>
              ["flac", "wav", "mp3", "m4a", "ogg", "midi", "mid"].includes(
                format
              )
            )
          ) {
            console.warn(
              "\n🛑🙊Invalid output format🙈🛑\n⚠️Only flac, ogg, wav, mp3, and m4a are allowed!"
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

    askFilePath();
  });
};
module.exports = getUserInput;
