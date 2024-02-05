const readline = require("readline");
const {
  openSync,
  closeSync,
  readdirSync,
  statSync,
  existsSync,
  appendFileSync,
  writeFileSync,
} = require("fs");
const { join, basename, extname, dirname } = require("path");
const { Worker } = require("worker_threads");
const { performance } = require("perf_hooks");
const { cpus } = require("os");
const moment = require("moment");
const chalk = require("chalk");

let settings = {
  filePath: "",
  inputFormats: [],
  outputFormats: [],
  //bitrate: 0, placehold for future options
  //quality: 2,
};

const handleError = (errorMessage) => {
  console.error(errorMessage);
  //process.exit(1);
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
  const logPath = settings.filePath;
  let fileName = `${logPath}/logs.csv`;
  const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
  if (log.type === "stderr") {
    fileName = `${logPath}/error.csv`;

    if (!existsSync(fileName)) {
      try {
        console.log("error.csv did not exist");
        writeFileSync(fileName, "Timestamp,Error, file\n");
        return;
      } catch (error) {
        console.error("ADD to LOG ERROR");
        return addToLog(log, file);
      }
    }
    log.data = log.data.replace(/\r\n|\r/g, "");
    try {
      const csvRow = `${timestamp},${log.data},${file.inputFile},${file.outputFile}\n`;
      appendFileSync(fileName, csvRow);
    } catch (err) {
      console.error(`🚨🚨⛔ Error writing to CSV file: ${err} ⛔🚨🚨`);
    }
    return;
  }
  if (!existsSync(fileName)) {
    try {
      console.log("logs.csv did not exist");
      writeFileSync(fileName, "Timestamp,Exit Code, Input, Output\n"); // Header for the CSV file
      return;
    } catch (error) {
      return addToLog(log, file);
    }
  }
  try {
    const csvRow = `${timestamp},${log.data},${file.inputFile},${file.outputFile}\n`;
    appendFileSync(fileName, csvRow);
  } catch (err) {
    console.error(`🚨🚨⛔ Error writing to CSV file: ${err} ⛔🚨🚨`);
  }
};
//       console.warn(
//         chalk.yellow(
//           `Here's a yellow line, ${chalk.bold.blue.underline(
//             "with a segment with underlined blue text"
//           )} and then back to yellow.`
//         )
//       );
//       console.log(`
//   Folders: ${chalk.green("✔ done!")}
//   Analytics: ${chalk.green("✔ processed!")}
//   MergedOutput: ${chalk.green("✔ created!")}

// `);
// const errorStyle = chalk.bold.red;
// const successStyle = chalk.bold.green;
const vaporStyle = chalk.bgMagenta.bold.cyan;
// Save the original console.error function
const originalConsoleError = console.error;

// Override console.error with a custom function
console.error = function (...args) {
  // Apply chalk.red to all arguments
  const coloredArgs = args.map((arg) => chalk.red.bold(arg));

  // Call the original console.error with colored arguments
  originalConsoleError.apply(console, coloredArgs);
};

// Example usage
// console.error("This is an error message in red!");
// Save the original console.error function
const originalConsolwarn = console.warn;

// Override console.error with a custom function
console.warn = function (...args) {
  // Apply chalk.red to all arguments
  const coloredArgs = args.map((arg) => chalk.yellow.bold(arg));

  // Call the original console.error with colored arguments
  originalConsolwarn.apply(console, coloredArgs);
};
// Example usage
// console.warn("This is an error message in red!");
// console.log(chalk.bgRed.cyanBright("This will look pretty ugly!"));
// const boldUnderline = chalk.bold.underline.green;

// console.log(boldUnderline("This is bold and underlined green text!"));
// // easy styled error/success messages!
// console.error(successStyle("Yay! This is a success message!"));
// console.log(errorStyle("Oops! This is an error message!"));

// console.log(chalk.green("This text is green!"));
// console.log(chalk.blue.bold("This text is bold and blue!"));
console.log(
  vaporStyle(`
**************************************************************************************************************************
*                                                                                                                        *
*   MM""""""""'M M""""""""'M    MM'"""""'MM                                 MMP"""""""MM                dP oo            *
*   MM  mmmmmmmM Mmmmmm   .M    M' .mmm. 'M                                 M' .mmmm  MM                88               *
*   M'      MMMM MMMMP  .MMM    M  MMMMMMMM .d8888b. 88d8b.d8b. .d8888b.    M         'M dP    dP .d888b88 dP .d8888b.   *
*   MM  MMMMMMMM MMP  .MMMMM    M  MMM   'M 88'  '88 88''88''88 88ooood8    M  MMMMM  MM 88    88 88'  '88 88 88'  '88   *
*   MM  MMMMMMMM M' .MMMMMMM    M. 'MMM' .M 88.  .88 88  88  88 88.  ...    M  MMMMM  MM 88.  .88 88.  .88 88 88.  .88   *
*   MM        .M M         M    MM.     .MM '88888P8 dP  dP  dP '88888P'    M  MMMMM  MM '88888P' '88888P8 dP '88888P'   *
*   MMMMMMMMMMMM MMMMMMMMMMM    MMMMMMMMMMM                                 MMMMMMMMMMMM                                 *
*                                                                                                                        *
*   MM'""""'YMM                                                dP                                                        *
*   M' .mmm. 'M                                                88                                                        *
*   M  MMMMMooM .d8888b. 88d888b. dP   .dP .d8888b. 88d888b. d8888P .d8888b. 88d888b.                                    *
*   M  MMMMMMMM 88'  '88 88'  '88 88   d8' 88ooood8 88'  '88   88   88ooood8 88'  '88                                    *
*   M. 'MMM' .M 88.  .88 88    88 88 .88'  88.  ... 88         88   88.  ... 88                                          *
*   MM.     .dM '88888P' dP    dP 8888P'   '88888P' dP         dP   '88888P' dP                                          *
*   MMMMMMMMMMM                                                                                                          *
*                                                                                                                        *
**************************************************************************************************************************
`)
);
//Starts with user input
const getAnswer = async (question) =>
  new Promise((res) => rl.question(question, (ans) => res(ans)));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const UserInputInitSettings = () => {
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

//Searches for files that meet criteria
const searchFiles = (settings) => {
  const fileExtensions = settings.inputFormats.map((format) => `.${format}`);
  const searchPath = settings.filePath;
  //midi can have .mid or .midi extension
  if (settings.inputFormats.includes("midi")) {
    fileExtensions.push(".mid");
  }

  const allFiles = [];

  const walk = (dir) => {
    const files = readdirSync(dir);

    for (const file of files) {
      const filePath = join(dir, file);
      const stats = statSync(filePath);

      if (stats.isDirectory()) {
        // Recursively walk into subdirectories
        walk(filePath);
      } else {
        // Check if the file has a matching extension
        const fileExtension = extname(file).toLowerCase();
        if (fileExtensions.includes(fileExtension)) {
          allFiles.push(filePath);
        }
      }
    }
  };

  walk(searchPath);
  console.log(
    chalk.whiteBright.bold("\n🔍 Matched", allFiles.length, "Input Files:"),
    allFiles
  );

  return Promise.resolve(allFiles);
};

//deletes duplicate files with different extname
const deleteDuplicateFiles = (files) => {
  const priorityList = [".ogg", ".mp3", ".m4a", ".wav", ".flac"];
  const fileobjs = files.map((file) => [
    join(dirname(file), basename(file, extname(file))),
    extname(file),
  ]);

  const uniq = new Map();

  for (const [name, ext] of fileobjs) {
    if (!uniq.has(name)) {
      uniq.set(name, ext);
      continue;
    }

    const current = uniq.get(name);
    if (priorityList.indexOf(ext) > priorityList.indexOf(current)) {
      uniq.set(name, ext);
    }
  }
  return Array.from(uniq.entries()).reduce(
    (p, c) => [...p, `${c[0]}${c[1]}`],
    []
  );
};

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

      if (inputFile == outputFile) continue;

      const responseActions = {
        o: () => {
          return (response = null);
        },
        oa: () => {
          /* Nothing to do as default is overwrite */
        },
        r: () => {
          outputFile = outputFileCopy;
          return (response = null);
        },
        ra: () => {
          outputFile = outputFileCopy;
        },
        s: () => {
          outputFile = "skipped! ⏭️";
          return (response = null);
        },
        sa: () => {
          outputFile = "skipped! ⏭️";
        },
      };
      switch (response) {
        case "":
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
              } else break;
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

//Creaters workers to conver files
const convertFiles = async (files) => {
  const jobStartTime = performance.now();
  await isFileBusy(`${settings.filePath}/logs.csv`);
  await isFileBusy(`${settings.filePath}/error.csv`);
  try {
    var cpuNumber = cpus().length;
  } catch {
    var cpuNumber = 8;
    console.warn(
      "🚨🚨⛔ Could not detect amount of CPU cores!!! Setting to 8 ⛔🚨🚨"
    );
  }

  const maxConcurrentWorkers = Math.round(Math.min(cpuNumber, files.length));
  const failedFiles = [];
  const successfulFiles = [];
  console.info("\n   Detected 🕵️‍♂️", cpuNumber, "CPU Cores 🖥");
  console.log("   Using", cpuNumber, "concurrent 🧵 threads");

  const processFile = async (file, workerCounter, task, tasksLeft) => {
    const workerStartTime = performance.now();
    console.log(
      chalk.cyanBright(
        `\n🛠️👷‍♂️ Worker ${workerCounter} has started 📋 task ${task} with ${tasksLeft} tasks left on outputfile:\n   ${file.outputFile}📤`
      )
    );

    return new Promise((resolve, reject) => {
      const worker = new Worker("./converter.js", {
        workerData: file,
      });

      worker.on("message", (message) => {
        if (message.type === "stderr") {
          console.error("ERROR MESSAGE FROM FFMPEG", message.data);
          addToLog(message, file);
          return;
        }
        if (message.type === "code") {
          const workerEndTime = performance.now();
          const workerCompTime = workerEndTime - workerStartTime;
          addToLog(message, file);
          if (message.data === 0) {
            successfulFiles.push(file);
            console.log(
              chalk.greenBright(
                `\n🛠️👷‍♂️ Worker`,
                workerCounter,
                `finished task`,
                task,

                `\n   Input"${file.inputFile}\n   Output"${
                  file.outputFile
                }✅\n   in ${workerCompTime.toFixed(0)} milliseconds🕖`
              )
            );
            resolve();
          } else if (message.data !== 0) {
            if (!failedFiles[file]) {
              failedFiles.push(file);
            }
            console.error(
              // chalk.bgRed(
              "\n🚨🚨⛔ Worker",
              workerCounter,
              "did not finish file ⛔🚨🚨: ",
              file.outputFile,
              "🔇"
              // )
            );
            resolve();
          }
        }
      });
      worker.on("error", (code) => {
        console.error(`🚨🚨⛔ Worker had an error with code:`, code, "⛔🚨🚨");
        reject(code);
      });

      worker.on("exit", (code) => {});
    });
  };

  // Worker Manger
  const workerPromises = [];
  let workerCounter = 0;
  let task = 0;
  for (let i = 0; i < maxConcurrentWorkers; i++) {
    workerPromises.push(
      (async () => {
        while (files.length > 0) {
          const file = files.pop();
          try {
            let tasksLeft = files.length;
            task++;
            workerCounter++;
            if (workerCounter > 8) workerCounter = workerCounter - 8;
            await processFile(file, workerCounter, task, tasksLeft);
          } catch (error) {
            console.error("ERROR", error);
          }
        }
      })()
    );
  }

  await Promise.all(workerPromises);
  return { failedFiles, successfulFiles, jobStartTime };
};

const finalize = async (failedFiles, successfulFiles, jobStartTime) => {
  const jobEndTime = performance.now();
  let totalTime = jobEndTime - jobStartTime;
  totalTime = totalTime / 1000;
  let average = (totalTime * 10) / successfulFiles.length;
  console.log(
    `\n    📋 Total job duration: ${totalTime.toFixed(
      2
    )} seconds\n    ⌛ Average task duration ${average.toFixed(2)} seconds\n`
  );
  if (successfulFiles && successfulFiles.length > 0) {
    console.log(
      "    ",
      successfulFiles.length,
      "🚀 Successful Files 🚀",
      successfulFiles.map((file) => `✅ ${file.outputFile} `)
    );
  } else {
    console.log("\n💀😭😢NO SUCCESSFUL CONVERSIONS.😢😭💀\n");
  }

  if (failedFiles && failedFiles.length > 0) {
    console.log(
      failedFiles.length,
      "🛑 Failed Files 🛑",
      failedFiles.map((file) => `❌ ${file.outputFile}`)
    );
  } else {
    console.log("🚀🎉✨No conversions failed✨🎉🚀");
  }
  console.log(" 🌞🌈🌼 Have a nice day! 🌼🌈🌞\n");

  const quit = () => {
    rl.question(chalk.blue("(☞ﾟヮﾟ)☞  Press Enter to close 🔚"), () => {
      rl.close();
      process.exit(); // Close the process when Enter is pressed
    });
  };

  // Call the quit function to initiate the process
  quit();
};

UserInputInitSettings(settings)
  // find all files of specified type in provided folder and all subfolders
  .then((settings) => searchFiles(settings))
  //delete files from the list that have the same name but different file extensions.
  //save the file that has the best format. Flac > wav > m4a > mp3
  .then((files) => deleteDuplicateFiles(files))
  //go through list of input files and make output list.
  //there can be multiple outputs and user input is needed here for output files
  // that already exist.
  .then((files) => {
    return createConversionList(files);
  })
  // Converts all files with workers threads
  .then((files) => {
    return convertFiles(files);
  })
  .then(({ failedFiles, successfulFiles, jobStartTime }) => {
    finalize(failedFiles, successfulFiles, jobStartTime);
  })
  .catch((error) => {
    console.error("Fatal Error");
    handleError(error);
  })
  .finally(() => {});
