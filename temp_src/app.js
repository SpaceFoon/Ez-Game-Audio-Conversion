// app.js
// Description: Prints title then runs a simple promise chain that runs the entire application.
// Uses require instead of module imports for compatibility with pkg which version locks chalk. Aww well...

function runApp() {
  const getUserInput = require("./getUserInput");
  const searchFiles = require("./searchFiles");
  // const deleteDuplicateFiles = require("./deleteDuplicateFiles");
  const createConversionList = require("./createConversionList");
  const { convertFiles } = require("./convertFiles");
  const { settings } = require("./utils");
  const finalize = require("./finalize");
  const cfonts = require("cfonts");
  const { platform } = require("os");
  const os = require("os");
  const ExitProgramError = require("./exitProgramError");
  require("dotenv").config();

  if (typeof globalThis.env === "undefined") {
    globalThis.env = {
      isDev: process.env.NODE_ENV === "dev",
      isDebug: process.env.DEBUG === "true",
      isPkg: process.env.PKG_ENV === "packaging",

      // OS info
      isWindows: os.platform() === "win32",
      isMac: os.platform() === "darwin",
      isLinux: os.platform() === "linux",
      arch: os.arch(), // e.g. 'x64'
      platform: os.platform(), // e.g. 'win32'
      cpuCount: os.cpus().length,
    };
  }

  // This only runs when packaging the file with pkg.js
  // It's to force the worker to be included in the package
  if (process.env.PKG_ENV === "packaging") {
    require("./converterWorker");
  }
  if (env.isDebug) {
    console.log("debug mode");
  }
  if (env.isDev) {
    console.log("in dev mode");
  }

  if (env.isDebug) {
    console.log("stdin is TTY:", process.stdin.isTTY);
    console.log("stdout is TTY:", process.stdout.isTTY);
  }

  process.stdout.write("\x1b]0;EZ Game Audio\x1b\x5c");
  process.stdout.write("\x1b]2;EZ Game Audio\x1b\x5c");

  cfonts.say("|||EZ Game|Audio", {
    font: "huge",
    align: "center",
    gradient: ["green", "#f80"],
    background: "black",
    // colors: ["red", "blue"],
    independentGradient: true, // define if you want to recalculate the gradient for each new line
    transitionGradient: false, // define if this is a transition between colors directly
    env: "node",
  });

  const userOS = platform() === "win32" ? "ffprobe.exe" : "ffprobe";
  settings.userOS = userOS;

  return (
    getUserInput(settings)
      // find all files of specified type in provided folder and all subfolders
      .then((settings) => searchFiles(settings))
      //delete files from the list that have the same name but different file extensions.
      //save the file that has the best format. Flac > wav > m4a > mp3
      // .then((files) => deleteDuplicateFiles(files))
      //go through list of input files and make output list.
      //there can be multiple outputs and user input is needed here for conflicting output files
      // that already exist.
      .then((files) => {
        return createConversionList(files);
      })
      // Manages workers threads in a pool.
      .then((files) => {
        return convertFiles(files);
      })
      // Print the final results of all conversions.
      .then(({ failedFiles, successfulFiles, jobStartTime }) => {
        finalize(failedFiles, successfulFiles, jobStartTime);
      })
      .catch((error) => {
        if (error instanceof ExitProgramError) {
          // Silent exit, do nothing
          return;
        }
        console.error("Fatal Error", error);
      })
  );
}

if (require.main === module) {
  runApp();
}

module.exports = runApp;
