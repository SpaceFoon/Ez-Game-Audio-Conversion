const { readdirSync, statSync } = require("fs");
const { join, extname } = require("path");
const chalk = require("chalk");

//Searches for files that meet criteria
const searchFiles = (settings) => {
  const fileExtensions = settings.inputFormats.map((format) => `.${format}`);
  const searchPath = settings.inputFilePath;
  //midi can have .mid or .midi extension
  if (settings.inputFormats.includes("midi")) {
    fileExtensions.push(".mid");
  }

  const allFiles = [];

  const walk = (dir) => {
    const files = readdirSync(dir);

    for (const file of files) {
      const inputFilePath = join(dir, file);
      const stats = statSync(inputFilePath);

      if (stats.isDirectory()) {
        // Recursively walk into subdirectories
        walk(inputFilePath);
      } else {
        // Check if the file has a matching extension
        const fileExtension = extname(file).toLowerCase();
        if (fileExtensions.includes(fileExtension)) {
          allFiles.push(inputFilePath);
        }
      }
    }
  };

  walk(searchPath);
  console.log(
    chalk.whiteBright.bold("\n🔍 Matched", allFiles.length, "Input Files:\n")
  );
  allFiles.forEach((inputFile) => {
    console.log(chalk.white(" 🎶 ", inputFile));
  });

  return Promise.resolve(allFiles);
};

module.exports = searchFiles;
