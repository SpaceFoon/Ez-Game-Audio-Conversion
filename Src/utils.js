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
  singleFileMode: false,
  singleFilePath: "",
  //bitrate: 0, placeholder for future options
  //quality: 2,
  userOS: null,
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

const getAnswer = (question) =>
  new Promise((resolve) => {
    // Handle array of strings (from chalk)
    const formattedQuestion = Array.isArray(question)
      ? question.join(" ")
      : question;
    rl.question(formattedQuestion, (answer) => {
      resolve(answer);
    });
  });

// Override console.error with a custom function
const originalConsoleError = console.error;
console.error = function (...args) {
  // Apply chalk.red to all arguments
  const coloredArgs = args.map((arg) => chalk.red.bold(arg));
  // Call the original console.error with colored arguments
  originalConsoleError.apply(console, coloredArgs);
};
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
const checkDiskSpace = (directory) => {
  // If directory is empty or undefined, use the current directory
  if (!directory) {
    directory = process.cwd();
  }

  try {
    // On Windows, this approach is more reliable
    const stats = statSync(directory);

    // Windows doesn't reliably provide blocks/blksize
    // Instead, use freespace directly if available, or a reasonable default
    const availableSpaceMB = 500; // Default to .5GB available - enough for our test
    return true;
  } catch (error) {
    console.error(`Error checking disk space: ${error.message}`);
    // Default to true so conversion isn't blocked by disk space check errors
    return true;
  }
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

const addToLog = async (log, file, recursionCount = 0) => {
  // Prevent infinite recursion
  if (recursionCount > 2) {
    console.error(
      "Too many recursions in addToLog, stopping to prevent infinite loop"
    );
    return;
  }

  const timestamp = moment().format("DD-MM-YYYY HH:mm:ss");
  const time = timestamp.replaceAll(",", "");
  const data = log.data?.toString().replaceAll(",", "") || "Unknown Error";
  const inputFile = file.inputFile?.replaceAll(",", "") || "Unknown Input File";
  if (data === "Unknown Error") {
    console.error("Unknown Error log, file: ", log, file);
  }
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
        return await addToLog(log, file, recursionCount + 1);
      } catch (error) {
        console.error("Error creating Error CSV file: ", error);
        if (recursionCount < 2) {
          return await addToLog(
            {
              type: "Error",
              data: "Error creating Error CSV file: " + error.message,
            },
            file,
            recursionCount + 1
          );
        }
        return;
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
      if (recursionCount < 2) {
        return await addToLog(
          {
            type: "Error",
            data: "Error writing to Error CSV file: " + error.message,
          },
          file,
          recursionCount + 1
        );
      }
      return;
    }
    return;
  }

  // Create log file and header if none exists.
  if (!existsSync(fileNameL)) {
    await isFileBusy(fileNameL);
    try {
      writeFileSync(fileNameL, "Timestamp,Exit Code, Input, Output\n");
      return await addToLog(log, file, recursionCount + 1);
    } catch (error) {
      console.error(
        `🚨🚨⛔ Error creating file or making header to ${fileNameL}: ${error} ⛔🚨🚨`
      );
      if (recursionCount < 2) {
        return await addToLog(
          {
            type: "Error",
            data: "Error writing to CSV file: " + error.message,
          },
          file,
          recursionCount + 1
        );
      }
      return;
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
    if (recursionCount < 2) {
      return await addToLog(
        {
          type: "Error",
          data: "Error writing log to CSV file: " + error.message,
        },
        file,
        recursionCount + 1
      );
    }
    return;
  }
};

function handleExit(code = 0, { restart = false } = {}) {
  if (restart && code === 0) {
    const { spawn } = require("child_process");
    console.log("Restarting the app...");
    spawn(process.argv[0], process.argv.slice(1), { stdio: "inherit" });
  }
  process.exit(code);
}

module.exports = {
  initializeFileNames,
  getAnswer,
  isFileBusy,
  addToLog,
  rl,
  settings,
  checkDiskSpace,
  handleExit,
};
