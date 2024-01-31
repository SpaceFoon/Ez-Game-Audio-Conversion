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

let settings = {
  filePath: "",
  inputFormats: [],
  outputFormats: [],
  //bitrate: 0,
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

// const writeLogs = async (message) => {
//   const logPath = settings.filePath;
//   let fileName = `${logPath}/logs.csv`;
//   if (message.type === "stderr") {
//     fileName = `${logPath}/errors.csv`;
//   }
//   try {
//     writeFileSync(fileName, "Timestamp,Data\n"); // Header for the CSV file
//   } catch (error) {}
// };

const addToLog = async (log) => {
  const logPath = settings.filePath;
  let fileName = `${logPath}/logs.csv`;
  if (log.type === "stderr") {
    fileName = `${logPath}/error.csv`;
    await isFileBusy(fileName);
    if (!fileName.existsSync) {
      try {
        writeFileSync(fileName, "Timestamp,Data\n"); // Header for the CSV file
      } catch (error) {
        return addToLog(log);
      }
    }
    const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
    console.log("message", log);
    const csvRow = `${timestamp},${log.data}\n`;

    appendFileSync(fileName, csvRow, (err) => {
      if (err) console.error(`🚨🚨⛔ Error writing to CSV file: ${err} ⛔🚨🚨`);
    });
  }
  if (log.type === "Success") {
    console.log(`Success`);
    console.log(`Success`);
  }
  if (log.type === "Failure") {
    console.log(`Failure`);
  }
  if (!log.type) {
    console.log("Type: ", type);
  }
  const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
  //console.log("message2", log);
  const csvRow = `${timestamp},${log.data}\n`;
  appendFileSync(fileName, csvRow, (err) => {
    if (err) console.error(`🚨🚨⛔ Error writing to CSV file: ${err} ⛔🚨🚨`);
  });
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
  console.log(`${jobStartTime} jobStartTime`);
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
    console.log(
      `\n🛠️ 👷‍♂️ Worker ${workerCounter} has started 📋 task ${task} with ${tasksLeft} left at outputfile:\n ${file.outputFile}📤`
    );
    // const inputFile = file.inputFile;
    // const outputFile = file.outputFile;
    return new Promise((resolve, reject) => {
      //const jobStartTime = performance.now();
      const worker = new Worker("./converter.js", {
        workerData: file,
      });

      worker.on("message", (message) => {
        //console.log("MESSAGE", message);
        addToLog(message);
        // if (message.type === "stderr") {
        //   const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        //   console.log("message", message);
        //   const csvRow = `${timestamp},${message.data}`;

        //   // // Append the CSV row to the file

        //   appendFileSync(logs, csvRow, (err) => {
        //     if (err)
        //       console.error(`🚨🚨⛔ Error writing to CSV file: ${err} ⛔🚨🚨`);
        //   });
        // }
      });

      worker.on("error", (code) => {
        console.error(`🚨🚨⛔ Worker had an error with code:`, code, "⛔🚨🚨");
        reject();
      });

      worker.on("exit", (code) => {
        const workerEndTime = performance.now().toFixed(2);
        const workerCompTime = workerEndTime - workerStartTime.toFixed(2);
        console.log(
          `🛠️👷‍♂️ Worker`,
          workerCounter,
          `finished task`,
          task,
          `\n   Input"${file.inputFile}\n   Output"${file.outputFile}✅\n   in ${workerCompTime} milliseconds🕖`
        );

        if (code !== 0) {
          console.error(
            "🚨🚨⛔ Worker",
            i + 1,
            "did not finish file ⛔🚨🚨\n",
            file.outputFile,
            "🔇"
          );
          if (!failedFiles[file]) {
            failedFiles.push(file);
          }
          console.error(
            `🚨🚨⛔ FFMPEG exited with code ⛔🚨🚨`,
            code,
            `at file \n   ⛔ ${file.inputFile} \n  ⛔ ${file.outputFile}`
          );
          reject();
        } else if (code === 0) {
          successfulFiles.push(file);
          resolve();
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
            console.error("ERROR", error);
            if (!failedFiles[file]) {
              failedFiles.push(file);
            }

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
