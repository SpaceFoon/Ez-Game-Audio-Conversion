//deletes duplicate files with different extname
const { join, basename, extname, dirname } = require("path");

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
module.exports = deleteDuplicateFiles;
