// app.js
// Description: Prints title then runs a  simple promise chain that runs the entire application.
// Uses require instead of module imports for compatibility with pkg.
const getUserInput = require("./getUserInput");
const searchFiles = require("./searchFiles");
const deleteDuplicateFiles = require("./deleteDuplicateFiles");
const createConversionList = require("./createConversionList");
const { convertFiles } = require("./convertFiles");
const { settings } = require("./utils");
const finalize = require("./finalize");
const { join } = require("path");
const cfonts = require("cfonts");

// This only runs when packaging the file with pkg.js
// It's to force the worker to be included in the package
if (process.env.PKG_ENV === "packaging") {
  const { converterWorker, runConversion } = require("./converterWorker");
}
join(__dirname, "./converterWorker.js");

process.stdout.write(`[Console]::Title = "EZ Game Audio"`);
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

// console.log(process.memoryUsage());
// Create a screen object.
// var screen = blessed.screen({
//   smartCSR: true,
// });

// screen.title = "EZ Game Audio";

// // Create a box perfectly centered horizontally and vertically.
// var box = blessed.box({
//   top: "center",
//   left: "center",
//   width: "90%",
//   height: "90%",
//   content: "Hello {bold}world{/bold}!",
//   tags: true,
//   border: {
//     type: "line",
//   },
//   style: {
//     fg: "white",
//     bg: "magenta",
//     border: {
//       fg: "#f0f0f0",
//     },
//     hover: {
//       bg: "green",
//     },
//   },
// });

// // Append our box to the screen.
// screen.append(box);

// // Add a png icon to the box
// var icon = blessed.image({
//   parent: box,
//   top: 0,
//   left: 0,
//   type: "overlay",
//   width: "shrink",
//   height: "shrink",
//   file: __dirname + "../src/ico/icon.ico",
//   search: false,
// });

// // If our box is clicked, change the content.
// box.on("click", function (data) {
//   box.setContent("{center}Some different {red-fg}content{/red-fg}.{/center}");
//   screen.render();
// });

// // If box is focused, handle `enter`/`return` and give us some more content.
// box.key("enter", function (ch, key) {
//   box.setContent(
//     "{right}Even different {black-fg}content{/black-fg}.{/right}\n"
//   );
//   box.setLine(1, "bar");
//   box.insertLine(1, "foo");
//   screen.render();
// });

// // Quit on Escape, q, or Control-C.
// screen.key(["escape", "q", "C-c"], function (ch, key) {
//   return process.exit(0);
// });

// // Focus our element.
// box.focus();

// // Render the screen.
// screen.render();
// // console.log(
// //   chalk.bgMagenta.bold.cyan(`
// ********************************************************************************************************************

//  MM""""""""'M M""""""""'M    MM'"""""'MM                                 MMP"""""""MM                dP oo
//  MM  mmmmmmmM Mmmmmm   .M    M' .mmm. 'M                                 M' .mmmm  MM                88
//  M'      MMMM MMMMP  .MMM    M  MMMMMMMM .d8888b. 88d8b.d8b. .d8888b.    M         'M dP    dP .d888b88 dP .d8888b.
//  MM  MMMMMMMM MMP  .MMMMM    M  MMM   'M 88'  '88 88''88''88 88ooood8    M  MMMMM  MM 88    88 88'  '88 88 88'  '88
//  MM  MMMMMMMM M' .MMMMMMM    M. 'MMM' .M 88.  .88 88  88  88 88.  ...    M  MMMMM  MM 88.  .88 88.  .88 88 88.  .88
//  MM        .M M         M    MM.     .MM '88888P8 dP  dP  dP '88888P'    M  MMMMM  MM '88888P' '88888P8 dP '88888P'
//  MMMMMMMMMMMM MMMMMMMMMMM    MMMMMMMMMMM                                 MMMMMMMMMMMM

//  MM'""""'YMM                                                       oo
//  M' .mmm. 'M
//  M  MMMMMooM .d8888b. 88d888b. dP   .dP .d8888b. 88d888b. .d8888b. dP .d8888b. 88d888b.
//  M  MMMMMMMM 88'  '88 88'  '88 88   d8' 88ooood8 88'  '88 Y8ooooo. 88 88'  '88 88'  '88
//  M. 'MMM' .M 88.  .88 88    88 88 .88'  88.  ... 88             88 88 88.  .88 88    88
//  MM.     .dM '88888P' dP    dP 8888P'   '88888P' dP       '88888P' dP '88888P' dP    dP
//  MMMMMMMMMMM

// ********************************************************************************************************************
// `)
// );

getUserInput(settings)
  // find all files of specified type in provided folder and all subfolders
  .then((settings) => searchFiles(settings))
  //delete files from the list that have the same name but different file extensions.
  //save the file that has the best format. Flac > wav > m4a > mp3
  .then((files) => deleteDuplicateFiles(files))
  //go through list of input files and make output list.
  //there can be multiple outputs and user input is needed here for conflicting output files
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
    console.error("Fatal Error", error);
  })
  .finally(() => {});
