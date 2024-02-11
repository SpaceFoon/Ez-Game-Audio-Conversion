const chalk = require("chalk");
const getUserInput = require("./getUserInput");
const searchFiles = require("./searchFiles");
const deleteDuplicateFiles = require("./deleteDuplicateFiles");
const createConversionList = require("./createConversionList");
const convertFiles = require("./convertFiles");
const { handleError, settings } = require("./utils");
const finalize = require("./finalize");
const { join } = require("path");
const { converterWorker, runConversion } = require("./converterWorker");
join(__dirname, "./converterWorker.js");

// console.log(converterWorker, runConversion);
// console.log("DIRNAME app", __dirname, __filename);

console.log(
  chalk.bgMagenta.bold.cyan(`
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
    console.error("Fatal Error");
    handleError(error);
  })
  .finally(() => {});
