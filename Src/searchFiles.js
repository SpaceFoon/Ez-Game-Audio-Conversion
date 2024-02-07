const { readdirSync, statSync } = require("fs");
const { join, extname } = require("path");
const chalk = require("chalk");

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

module.exports = searchFiles;
