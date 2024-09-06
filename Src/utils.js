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
  inputFilePath: "",
  outputFilePath: "",
  inputFormats: [],
  outputFormats: [],
  oggCodec: null,
  //bitrate: 0, placeholder for future options
  //quality: 2,
};

const getAnswer = async (question) =>
  new Promise((res) => rl.question(question, (ans) => res(ans)));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const originalConsoleError = console.error;

// Override console.error with a custom function
console.error = function (...args) {
  // Apply chalk.red to all arguments
  const coloredArgs = args.map((arg) => chalk.red.bold(arg));
  // Call the original console.error with colored arguments
  originalConsoleError.apply(console, coloredArgs);
};
// console.error("This is an error message in red!");
// Save the original console.error function
const originalConsolWarn = console.warn;
// Override console.error with a custom function
console.warn = function (...args) {
  // Apply chalk.red to all arguments
  const coloredArgs = args.map((arg) => chalk.yellow.bold(arg));
  // Call the original console.error with colored arguments
  originalConsolWarn.apply(console, coloredArgs);
};

// If a file is not writing, check the disk space.
const checkDiskSpace = async (directory) => {
  statSync(directory, (error, stats) => {
    if (error) {
      console.error("Error:", error);
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

// If a file fails to read or write, check if it is busy.
const isFileBusy = async (file) => {
  if (!existsSync(file)) return false;
  try {
    const fd = openSync(file, "r+");
    closeSync(fd);
    return false;
  } catch (error) {
    if (error.code === "EBUSY") {
      await getAnswer(
        chalk.redBright(
          `\n${error}\n🚨🚨⛔ Close ${file} and press Enter to continue ⛔🚨🚨`
        )
      );
      // return isFileBusy(file);
    } else if (error.code === "ENOENT") {
      console.error("code", error);
    } else {
      console.error(
        `\n🚨🚨⛔ Error checking status of Log file: ${error.message} ⛔🚨🚨`
      );
      throw error;
    }
  }
};

// Error logging to CSV.
let fileNameL = null;
let fileNameE = null;

const initializeFileNames = () => {
  const logPath = settings.outputFilePath;
  fileNameL = initFileName(logPath, "logs");
  fileNameE = initFileName(logPath, "error");
};

const initFileName = (basePath, fileName) => {
  let num = 1;
  let fullFileName = `${basePath}/${fileName}.csv`;

  while (existsSync(fullFileName)) {
    fullFileName = `${basePath}/${fileName}(${num}).csv`;
    num++;
  }

  return fullFileName;
};

const addToLog = async (log, file) => {
  const timestamp = moment().format("DD-MM-YYYY HH:mm:ss");
  const time = timestamp.replaceAll(",", "");
  const data = log.data?.toString().replaceAll(",", "") || "Unknown Error";
  const inputFile = file.inputFile?.replaceAll(",", "") || "Unknown Input File";
  const outputFile =
    file.outputFile?.replaceAll(",", "") || "Unknown Output File";
  const logPath = settings.outputFilePath;

  // Determine if the log is an error or not.
  if (log.type === "stderr" || log.type === "error") {
    // console.log("log in utils", log);

    await isFileBusy(fileNameE);

    // Create error log file and header if none exists.
    if (!existsSync(fileNameE)) {
      try {
        writeFileSync(fileNameE, "Timestamp, Error, Input File, Output File\n");
        return await addToLog(log, file);
      } catch (error) {
        console.error("Error creating Error CSV file: ", error);
        return await addToLog(
          ((log.type = "Error"),
          (log.data = "Error creating Error CSV file: ")),
          error
        );
      }
    }

    // Write error line
    try {
      await isFileBusy(fileNameE);
      const csvRow =
        `${time},${data},${inputFile},${outputFile}`.replace(/[\r\n]+/g, "") +
        "\n";
      appendFileSync(fileNameE, csvRow);
    } catch (error) {
      console.error(`🚨🚨⛔ Error writing to ${fileNameE}: ${error} ⛔🚨🚨`);
      return await addToLog(
        ((log.type = "Error"),
        (log.data = "Error writing to Error CSV file: ")),
        error
      );
    }
    return;
  }

  // Create log file and header if none exists.
  if (!existsSync(fileNameL)) {
    await isFileBusy(fileNameL);
    try {
      writeFileSync(fileNameL, "Timestamp,Exit Code, Input, Output\n");
      return await addToLog(log, file);
    } catch (error) {
      console.error(
        `🚨🚨⛔ Error creating file or making header to ${fileNameL}: ${error} ⛔🚨🚨`
      );
      return await addToLog(
        ((log.type = "Error"), (log.data = "Error writing to CSV file: ")),
        error
      );
    }
  }
  // Write log line
  try {
    await isFileBusy(fileNameL);
    const csvRow =
      `${time},${data},${inputFile},${outputFile}\n`.replace(/[\r\n]+/g, "") +
      "\n";
    appendFileSync(fileNameL, csvRow);
  } catch (error) {
    console.error(`🚨🚨⛔ Error writing log to ${fileNameL}: ${error} ⛔🚨🚨`);
    return await addToLog(
      ((log.type = "Error"), (log.data = "Error writing log to CSV file: ")),
      error
    );
  }
};

module.exports = {
  initializeFileNames,
  getAnswer,
  isFileBusy,
  addToLog,
  rl,
  settings,
  checkDiskSpace,
};
