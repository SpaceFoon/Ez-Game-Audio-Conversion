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
const { reject } = require("when");
const moment = require("moment");
const { Console } = require("console");
const { exitCode } = require("process");

let settings = {
  filePath: "",
  inputFormats: [],
  outputFormats: [],
  //bitrate: 0, placehold for future options
  //quality: 2,
};

const handleError = (errorMessage) => {
  console.error(errorMessage);
  process.exit(1);
};

const getAnswer = async (question) =>
  new Promise((res, rej) => rl.question(question, (ans) => res(ans)));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const isFileBusy = async (file) => {
  if (!existsSync(file)) return false;
  try {
    // Try opening the file in write mode without blocking the event loop
    const fd = openSync(file, "w");
    closeSync(fd);
    return false; // File is not busy
  } catch (error) {
    if (error.code === "EBUSY") {
      const userInput = await getAnswer(
        `🚨🚨⛔ Close ${file} and press Enter to continue ⛔🚨🚨`
      );
      return isFileBusy(file);
    } else if (error.code === "ENOENT") {
    } else {
      console.error(`🚨🚨⛔ Error writing to CSV file: ${error} ⛔🚨🚨`);
      throw error;
    }
  }
};

const addToLog = async (log, file) => {
  const logPath = settings.filePath;
  let fileName = `${logPath}/logs.csv`;
  const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
  //await isFileBusy(fileName);
  if (log.type === "stderr") {
    fileName = `${logPath}/error.csv`;
    //await isFileBusy(fileName);

    if (!existsSync(fileName)) {
      try {
        console.log("error.csv did not exist");
        writeFileSync(fileName, "Timestamp,Error, file\n"); // Header for the CSV file
        return;
      } catch (error) {
        console.error("ADD to LOG ERROR");
        return addToLog(log, file);
      }
    }
    //replacing returns with commas for csv file
    log.data = log.data.replace(/\r\n|\r/g, "");
    //console.log("message", log, "file11 ", file);
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
    console.log("csvRow: " + csvRow);
    appendFileSync(fileName, csvRow);
  } catch (err) {
    console.error(`🚨🚨⛔ Error writing to CSV file: ${err} ⛔🚨🚨`);
  }
};

//Starts with user input
const UserInputInitSettings = () => {
  return new Promise((resolve, reject) => {
    const askFilePath = () => {
      rl.question(
        "✏️ Enter the full file path to start the search. 🔍 WILL SEARCH ALL SUB FOLDERS 📂: ",
        (filePath) => {
          if (!existsSync(filePath)) {
            console.error("⚠️File Path does not exist!🤣😊😂");
            askFilePath();
          } else {
            settings.filePath = filePath;
            console.log(`📝 File path: ${settings.filePath} ✅`);
            askInputFormats();
          }
        }
      );
    };

    const askInputFormats = () => {
      rl.question(
        "✏️ Enter the file extensions to look for. Leave blank for all 🚨 (e.g., flac wav mp3 m4a ogg midi): ",
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
            console.error(
              "🛑🙊Invalid input format🙈🛑\n⚠️Only flac, wav, mp3, m4a, ogg and midi are allowed"
            );
            askInputFormats();
          } else {
            console.log(
              `📝 Input formats: ${settings.inputFormats
                .map((el) => el + "✅ ")
                .join("")}`
            );
            askOutputFormats();
          }
        }
      );
    };

    const askOutputFormats = () => {
      rl.question(
        "✏️ Enter the output formats. Leave blank for all 🚨 (e.g., flac ogg mp3 m4a wav): ",
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
            console.error(
              "🛑🙊Invalid output format🙈🛑\n⚠️Only flac, ogg, wav, mp3, and m4a are allowed!"
            );
            askOutputFormats();
          } else {
            console.log(
              `📝 Output formats: ${settings.outputFormats
                .map((el) => el + "✅ ")
                .join("")}`
            );
            //console.log(settings);
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
  //console.log("Settings:", settings);
  const fileExtensions = settings.inputFormats.map((format) => `.${format}`);
  const searchPath = settings.filePath;
  //midi can have .mid or .midi extension
  if (settings.inputFormats.includes("midi")) {
    fileExtensions.push(".mid");
  }
  //console.log("Search Path:", searchPath);
  //console.log("File Extensions:", fileExtensions);

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
  console.log("🔍Matched", allFiles.length, "Input Files:", allFiles);

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
          console.log("🔺🚩OVERWRITE FILE🚩", outputFile, "🔺");
          break;
        default:
          while (true) {
            if (!response) {
              if (existsSync(outputFile)) {
                response = await getAnswer(
                  `${outputFile} already exists!
                  \n[O]verwrite, [R]ename or [S]kip. 👀 Add 'a' for all (e.g., oa, ra, sa)`
                );
                response = response.trim().toLowerCase();
                if (responseActions[response]) {
                  responseActions[response]();
                  break;
                } else {
                  response = null;
                  console.log("⚠️Invalid selection! Try again⚠️");
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
      "🔄 Pending conversion 🔄",
      conversionList.length,
      "files\n",
      numbered.join("\n")
    );
    const accept_answer = await getAnswer(
      '✏️ This is the list of files to be converted. Accept? Type "yes" ✅ or "no" ❌:  '
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
  // console.log(`${jobStartTime} jobStartTime`);
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
  console.info("Detected 🕵️‍♂️", cpuNumber, "CPU Cores 🖥");
  console.log("Using", cpuNumber, "concurrent 🧵 threads");

  const processFile = async (file, workerCounter, task, tasksLeft) => {
    const workerStartTime = performance.now();
    // await isFileBusy(`${settings.filePath}/logs.csv`);
    // await isFileBusy(`${settings.filePath}/errors.csv`);
    console.log(`\n📋 task ${task} started with ${tasksLeft} tasks left`);
    console.log(
      `🛠️ 👷‍♂️ Worker ${workerCounter} has started  at outputfile:\n ${file.outputFile}📤`
    );

    return new Promise((resolve, reject) => {
      const worker = new Worker("./converter.js", {
        workerData: file,
      });

      worker.on("stderr", (message) => {
        if (worker.exitCode) console.log("Exit code", exitCode);
        console.log("MESSAGE", message);
        //console.log("file", file);
        addToLog(message, file);
      });

      worker.on("error", (code) => {
        console.error(`🚨🚨⛔ Worker had an error with code:`, code, "⛔🚨🚨");
        reject(code);
      });

      worker.on("exit", (code) => {
        //console.log("EXIT_________________", code);
        const workerEndTime = performance.now();
        const workerCompTime = workerEndTime - workerStartTime;

        if (code !== 0) {
          if (!failedFiles[file]) {
            failedFiles.push(file);
          }
          console.error(
            "\n🚨🚨⛔ Worker",
            workerCounter,
            "did not finish file ⛔🚨🚨: ",
            file.outputFile,
            "🔇"
          );

          console.error(
            `\n🚨🚨⛔ FFMPEG exited with code ${code} ⛔🚨🚨`,
            `at file\n⛔ ${file.inputFile}\n⛔ ${file.outputFile}`
          );
          reject();
        } else if (code === 0) {
          console.log(
            `\n🛠️👷‍♂️ Worker`,
            workerCounter,
            `finished task`,
            task,

            `\n   Input"${file.inputFile}\n   Output"${
              file.outputFile
            }✅\n   in ${workerCompTime.toFixed(0)} milliseconds🕖`
          );
          successfulFiles.push(file);
          resolve();
        } else {
          console.error("No code in worker exit!!!!!!!!!!");
        }
      });
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
            // console.error("ERROR last", error);
            // console.log(failedFiles);
            // if (!failedFiles[file]) {
            //   failedFiles.push(file);
            //   console.log(failedFiles);
            // }

            reject(error);
          }
        }
      })()
    );
  }

  await Promise.all(workerPromises);
  return { failedFiles, successfulFiles, jobStartTime };
};

const finalize = (failedFiles, successfulFiles, jobStartTime) => {
  const jobEndTime = performance.now();
  // console.log(`Job end time ${jobEndTime}`);
  // console.log(`jobStartTime ${jobStartTime}`);
  // console.log(`successfulFiles.length ${successfulFiles.length}`);
  let totalTime = jobEndTime - jobStartTime;
  totalTime = Math.ceil(totalTime % 60);
  let average = totalTime / successfulFiles.length;
  average = Math.ceil(average % 60);
  // console.log(`average ${average}`);
  //console.log("failedfiles____", failedFiles);
  console.log(
    `\n    📋 Total job duration: ${totalTime.toFixed(
      0
    )} seconds\n    ⌛ Average task duration ${average.toFixed(0)} seconds\n`
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
  console.log("🌞🌈🌼 Have a nice day! 🌼🌈🌞");
  process.exit(0);
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
    console.log("Fatal Error");
    handleError(error);
  })
  .finally(() => {
    rl.close();
  });
