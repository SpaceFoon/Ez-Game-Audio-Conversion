const readline = require("readline");
const {
  openSync,
  closeSync,
  existsSync,
  appendFileSync,
  writeFileSync,
  statSync,
} = require("fs");
const moment = require("moment");
const chalk = require("chalk");

let settings = {
  filePath: "",
  outputFilePath: "",
  inputFormats: [],
  outputFormats: [],
  oggCodec: "",
  //bitrate: 0, placeholder for future options
  //quality: 2,
};

const getAnswer = async (question) =>
  new Promise((res) => rl.question(question, (ans) => res(ans)));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const handleError = (errorMessage) => {
  console.error(errorMessage);
  //process.exit(1);
};
const originalConsoleError = console.error;

console.error = function (...args) {
  const coloredArgs = args.map((arg) => chalk.red.bold(arg));
  originalConsoleError.apply(console, coloredArgs);
};

console.warn = function (...args) {
  const coloredArgs = args.map((arg) => chalk.yellow.bold(arg));
  originalConsolwarn.apply(console, coloredArgs);
};

const isFileBusy = async (file) => {
  if (!existsSync(file)) return false;
  try {
    const fd = openSync(file, "r+");
    closeSync(fd);
    return false;
  } catch (error) {
    if (error.code === "EBUSY") {
      const userInput = await getAnswer(
        chalk.redBright(
          `\n${error}\n🚨🚨⛔ Close ${file} and press Enter to continue ⛔🚨🚨`
        )
      );
      return isFileBusy(file);
    } else if (error.code === "ENOENT") {
      console.error("code", error);
    } else {
      console.error(`\n🚨🚨⛔ Error writing to CSV file: ${error} ⛔🚨🚨`);
      throw error;
    }
  }
};

const addToLog = async (log, file) => {
  const logPath = settings.outputFilePath;
  let fileName = `${logPath}/logs.csv`;
  const timestamp = moment().format("DD-MM-YYYY HH:mm:ss");
  if (log.type === "stderr") {
    fileName = `${logPath}/error.csv`;

    if (!existsSync(fileName)) {
      try {
        //console.log("error.csv did not exist");
        writeFileSync(fileName, "Timestamp,Error, file\n");
        return;
      } catch (error) {
        console.error("ADD to LOG ERROR");
        return addToLog(log, file);
      }
    }
    log.data = log.data.replace(/\r\n|\r/g, "");
    try {
      const csvRow =
        `${timestamp},${log.data},${file.inputFile},${file.outputFile}\n`.replace(
          /,/g,
          ""
        );
      appendFileSync(fileName, csvRow);
    } catch (err) {
      console.error(`🚨🚨⛔ Error writing to CSV file: ${err} ⛔🚨🚨`);
    }
    return;
  }
  if (!existsSync(fileName)) {
    try {
      //console.log("logs.csv did not exist");
      writeFileSync(fileName, "Timestamp,Exit Code, Input, Output\n"); // Header for the CSV file
      return;
    } catch (error) {
      return addToLog(log, file);
    }
  }
  try {
    const csvRow =
      `${timestamp},${log.data},${file.inputFile},${file.outputFile}\n`.replace(
        /,/g,
        ""
      );
    appendFileSync(fileName, csvRow);
  } catch (err) {
    console.error(`🚨🚨⛔ Error writing to CSV file: ${err} ⛔🚨🚨`);
  }
};

const checkDiskSpace = async (directory) => {
  statSync(directory, (err, stats) => {
    if (err) {
      console.error("Error:", err);
      return;
    }

    const availableSpaceMB = (stats["blksize"] * stats["blocks"]) / 1024 / 1024;

    if (availableSpaceMB >= 50) {
      console.log("There is at least 50 megabytes of disk space available.");
    } else {
      console.log("There is not enough disk space available.");
    }
  });
};
module.exports = {
  getAnswer,
  handleError,
  isFileBusy,
  addToLog,
  rl,
  settings,
  checkDiskSpace,
};
