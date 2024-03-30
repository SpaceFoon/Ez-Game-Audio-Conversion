const { join, basename, extname, dirname } = require("path");
const chalk = require("chalk");

const deleteDuplicateFiles = (files) => {
  const priorityList = [
    "midi",
    "mid",
    ".ogg",
    ".mp3",
    ".m4a",
    ".wav",
    "aiff",
    ".flac",
  ];
  const fileobjs = files.map((file) => [
    join(dirname(file), basename(file, extname(file))),
    extname(file),
  ]);

  const uniq = new Map();
  const droppedFiles = [];

  for (const [name, ext] of fileobjs) {
    if (!uniq.has(name)) {
      uniq.set(name, ext);
      continue;
    }

    const current = uniq.get(name);
    if (priorityList.indexOf(ext) > priorityList.indexOf(current)) {
      console.log(
        chalk.yellow(`Replacing file: ${name}${current} with ${name}${ext}`)
      );
      droppedFiles.push(`${name}${current}`);
      uniq.set(name, ext);
    } else {
      console.log(
        chalk.yellow(
          `Replacing input file: ${name}${current} with ${name}${ext}`
        )
      );
      droppedFiles.push(`${name}${ext}`);
    }
  }

  const uniqueFiles = Array.from(uniq.entries()).reduce(
    (p, c) => [...p, `${c[0]}${c[1]}`],
    []
  );

  // console.log(
  //   chalk.blue(`Unique files after processing: ${uniqueFiles.join(", ")}`)
  // );
  console.log(
    chalk.bgYellow(`Dropped from input list: ${droppedFiles.join(", ")}`)
  );

  return uniqueFiles;
};

module.exports = deleteDuplicateFiles;
