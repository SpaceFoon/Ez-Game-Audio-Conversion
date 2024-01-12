const readline = require("readline");
const { readdirSync, statSync, existsSync } = require("fs");
const { join, basename, extname, dirname } = require("path");
const { Worker } = require("worker_threads");

//setup object and functions.
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

//Starts with user input
const UserInputInitSettings = () => {
  return new Promise((resolve, reject) => {
    rl.question(
      "Enter the full file path to start search. WILL SEARCH ALL SUB FOLDERS: ",
      async (filePath) => {
        if (filePath === "") handleError("Must specify file path!");
        settings.filePath = filePath;
        console.log(`File path: ${settings.filePath}`);
        rl.question(
          "Enter the file extensions to look for. Leave blank for all (e.g., flac wav mp3 m4a ogg midi): ",
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
              reject(
                "Invalid output format. Only mp3 wav m4a and flac are allowed."
              );
            }
            console.log(`Input formats: ${settings.inputFormats}`);

            rl.question(
              "Enter the output formats. Leave blank for ogg (e.g., flac ogg mp3 m4a wav): ",
              (outputFormatString) => {
                settings.outputFormats = outputFormatString
                  ? outputFormatString.toLowerCase().split(" ")
                  : ["flac", "wav", "mp3", "m4a", "ogg"];
                if (
                  settings.outputFormats.length === 0 ||
                  !settings.outputFormats.every((format) =>
                    [
                      "flac",
                      "wav",
                      "mp3",
                      "m4a",
                      "ogg",
                      "midi",
                      "mid",
                    ].includes(format)
                  )
                ) {
                  reject(
                    "Invalid output format. Only flac ogg wav mp3 and m4a are allowed."
                  );
                }
                console.log(`Output formats: ${settings.outputFormats}`);
                console.log(settings);
                resolve(settings);
              }
            );
          }
        );
      }
    );
  });
};
//Searches for files that meet criteria
const searchFiles = (settings) => {
  console.log("Settings:", settings);
  const fileExtensions = settings.inputFormats.map((format) => `.${format}`);
  const searchPath = settings.filePath;
  //midi can have .mid or .midi extension
  if (settings.inputFormats.includes("midi")) {
    fileExtensions.push(".mid");
  }
  console.log("Search Path:", searchPath);
  console.log("File Extensions:", fileExtensions);

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
  console.log("Matching ", allFiles.length, "Files:", allFiles);

  return Promise.resolve(allFiles);
};

//deletes duplicate files with different extname
const deleteDuplicateFiles = (files) => {
  const priorityList = [".ogg", ".mp3", ".m4a", ".wav", ".flac"];
  //console.log('files', files);
  const fileobjs = files.map((file) => [
    join(dirname(file), basename(file, extname(file))),
    extname(file),
  ]);

  const uniq = new Map();

  for (const [name, ext] of fileobjs) {
    //console.log('name :>> ', name);
    //console.log('ext :>> ', ext);
    if (!uniq.has(name)) {
      uniq.set(name, ext);
      continue;
    }

    const current = uniq.get(name);
    // console.log('current :>> ', current);
    // console.log('priorityList.indexOf(ext) :>> ', priorityList.indexOf(ext));
    // console.log('priorityList.indexOf(current) :>> ', priorityList.indexOf(current));
    // console.log('priorityList.indexOf(ext) > priorityList.indexOf(current) :>> ', priorityList.indexOf(ext) > priorityList.indexOf(current));
    if (priorityList.indexOf(ext) > priorityList.indexOf(current)) {
      uniq.set(name, ext);
    }
  }
  return Array.from(uniq.entries()).reduce(
    (p, c) => [...p, `${c[0]}${c[1]}`],
    []
  );
};

//Create final list of files to convert and ask user for each file
const createConversionList = async (settings, files) => {
  const conversionList = [];
  let response = null;
  //console.log("files--------", files);
  for (const inputFile of files) {
    for (const outputFormat of settings.outputFormats) {
      let outputFile = `${join(
        dirname(inputFile),
        basename(inputFile, extname(inputFile))
      )}.${outputFormat}`;
      //console.log(`${inputFile}`)
      //console.log(`${outputFile}`)
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
          outputFile = "skipped!";
          return (response = null);
        },
        sa: () => {
          outputFile = "skipped!";
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
          console.log("OVERWRITE FILE", outputFile);
          break;
        default:
          while (true) {
            if (!response) {
              if (existsSync(outputFile)) {
                response = await getAnswer(
                  `[O]verwrite, [R]ename or [S]kip. Add 'a' for all (e.g., oa, ra, sa)'\n'${outputFile}? : `
                );
                response = response.trim().toLowerCase();
                if (responseActions[response]) {
                  responseActions[response]();
                  break;
                } else {
                  response = null;
                  console.log(
                    "You did not enter a valid selection, try again."
                  );
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
      (x, index) => `${index + 1} ${x.outputFile}`
    );
    console.log(
      "Pending conversion:",
      conversionList.length,
      "files",
      numbered.join("\n")
    );
    const accept_answer = await getAnswer(
      "This is the list of files to be converted. Accept? Type yes or no: "
    );

    if (/^no$/i.test(accept_answer)) {
      console.log("Conversion cancelled. Exiting program.");
      process.exit(0);
    }
    if (!/^yes$/i.test(accept_answer)) {
      console.warn('invalid input, please use "yes" or "no"');
      continue;
    }
    return conversionList.filter((x) => x.outputFile !== "skipped!");
  }
};

//Use ffmpeg to convert files
/**
 * Converts audio files to different formats.
 * @param {Array<{inputFile: string, outputFile: string, outputFormat: string}>} files - The array of files to convert, each containing the input file path, output file path, and output format.
 * @returns {Promise<void>} - A promise that resolves when all conversions are complete.
 */
const convert = async (files) => {
  //console.log("files99999", files);
  const promises = files.map(
    (file, index) =>
      new Promise((resolve, reject) => {
        console.log("file", index + 1, file);

        const worker = new Worker("./converter.js", { workerData: file });

        worker.on("message", (msg) => {
          //console.log(`worker.on("message",: ${msg}`)
        });
        worker.on("error", (err) => {
          console.error(err);
          reject(err);
        });
        worker.on("exit", (code) => {
          if (code !== 0) {
            reject(
              new Error(
                `Worker exited with code ${code} at file ${file.outputFile}.`
              )
            );
          } else {
            //console.log(`Worke111r exited with code ${code} at file ${file}.`);
            resolve();
          }
        });
      })
  );

  await Promise.all(promises);
};

finalize = (files) => {
  console.log("Have a nice day: ");
  process.exit(0);
};
UserInputInitSettings()
  // find all files of specified type in provided folder and all subfolders
  .then((settings) => searchFiles(settings))
  //delete files from the list that have the same name but different file extensions.
  //save the file that has the best format. Flac > wav > m4a > mp3
  .then((files) => deleteDuplicateFiles(files))
  // .then((files) => {
  //   console.log("files after dup", files);
  // })
  //go through list of input files and make output list.
  //there can be multiple outputs and user input is needed here for output files
  // that already exist.
  // find and replace spaces in files names
  //.then((files) => checkFileNames(files))
  .then((files) => {
    return createConversionList(settings, files);
  })
  // this is used to convert audio to m4a
  .then((files) => convert(files))

  .then((files) => finalize(files))

  .catch((error) => {
    handleError(error);
  })
  .finally(() => {
    rl.close();
  });
