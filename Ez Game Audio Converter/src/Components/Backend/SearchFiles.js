import { readDir } from "@tauri-apps/api/fs";
import { deleteDuplicateFiles } from "./deleteDups";
export default async function searchFiles(searchPath, fileExtensions) {
  try {
    console.log("Search Path:", searchPath);
    console.log("File Extensions:", fileExtensions);

    const allFiles = [];

    const walk = (arr) => {
      for (const { name, path, children } of arr) {
        if (
          !children &&
          fileExtensions.includes(name.split(".").pop().toLowerCase())
        )
          allFiles.push(path);
        if (children && children.length > 0) walk(children);
      }
    };

    const entries = await readDir(searchPath, { recursive: true });
    for (const entry of entries) {
      const { name, path, children } = entry;
      if (
        !children &&
        fileExtensions.includes(name.split(".").pop().toLowerCase())
      )
        allFiles.push(path);

      if (children && children.length > 0) walk(children);
    }

    console.log("allFiles", allFiles);

    const deduped = await deleteDuplicateFiles(allFiles);

    const removed = allFiles.filter((file) => !deduped.includes(file));

    console.log("deduped", deduped);
    console.log("removed", removed);

    return { deduped, removed };
  } catch (error) {
    console.error(error);
  }
}
