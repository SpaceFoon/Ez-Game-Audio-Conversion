//Creates workers to convert files

const { Worker } = require("worker_threads");
const { performance } = require("perf_hooks");
const { cpus } = require("os");
const chalk = require("chalk");
const {
  initializeFileNames,
  addToLog,
  settings,
  checkDiskSpace,
} = require("./utils");

const convertFiles = async (files) => {
  initializeFileNames();
  const jobStartTime = performance.now();
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
    checkDiskSpace(settings.outputFilePath);
    console.log(
      chalk.cyanBright(
        `\n🛠️👷‍♂️ Worker ${workerCounter} has started 📋 task ${task} with ${tasksLeft} tasks left on output file:\n   ${file.outputFile}📤`
      )
    );

    return new Promise((resolve, reject) => {
      // console.log("settings-------", settings);
      const worker = new Worker(`${__dirname}/converterWorker.js`, {
        workerData: { file, settings },
      });

      worker.on("message", (message) => {
        // Errors messages
        if (message.type === "error" || message.type === "stderr") {
          console.error(
            "ERROR MESSAGE FROM FFMPEG:",
            message.data,
            "Output file:",
            file.outputFile
          );
          // Catch disk space errors and stop a runway process
          if (/no space left/i.test(message.data)) {
            console.error(
              "\n 🚨⛔🚨 Stopping due to insufficient disk space! 🚨💽🚨"
            );
            process.exit(1);
          }
          addToLog(message, file);
          reject(new Error(message.data));
          return;
        }

        // File Success code
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
            // File Failure code
          } else if (message.data !== 0) {
            if (!failedFiles[file]) {
              failedFiles.push(file);
            }
            console.error(
              chalk.bgRed(
                "\n🚨🚨⛔ Worker",
                workerCounter,
                "did not finish file successfully ⛔🚨🚨: ",
                file.outputFile,
                "🔇"
              )
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
            console.error(error);
          }
        }
      })()
    );
  }

  await Promise.all(workerPromises);
  return { failedFiles, successfulFiles, jobStartTime };
};
module.exports = { convertFiles };
