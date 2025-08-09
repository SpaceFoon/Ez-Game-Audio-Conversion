const { performance } = require("perf_hooks");
const { settings } = require("./utils");
const { spawn } = require("child_process");
const chalk = require("chalk");
const { rl } = require("./utils");

const finalize = async (failedFiles, successfulFiles, jobStartTime) => {
  const jobEndTime = performance.now();
  let totalTime = jobEndTime - jobStartTime;
  totalTime = totalTime / 1000;
  let average =
    (totalTime * 10) /
    (successfulFiles && successfulFiles.length ? successfulFiles.length : 1);
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
    console.log(" 🚀🎉✨No conversions failed✨🎉🚀");
  }
  console.log(
    ` 🌞🌈🌼 Log files are in: ${settings.outputFilePath} Have a nice day! 🌼🌈🌞\n`
  );

  function restartApp() {
    console.log("Restarting the app...");
    spawn(process.argv[0], process.argv.slice(1), {
      stdio: "inherit",
    });
    process.exit(); // Stop the current process
  }

  // Somewhere in your code, call restartApp() when you need to restart.
  restartApp();
  const quit = () => {
    rl.question(
      chalk.blue("(☞ﾟヮﾟ)☞  Press Enter to restart program 🔀"),
      () => {
        rl.close();
        process.exit();
      }
    );
  };
  quit();
};
module.exports = finalize;
