import { readDir } from "@tauri-apps/api/fs";
import { join, extname } from "@tauri-apps/api/path";
import { deleteDuplicateFiles } from "./deleteDups";
export default async function searchFiles(filePath, inputType) {
  try {
    const fileExtensions = inputType;
    const searchPath = filePath;

    console.log("Search Path:", searchPath);
    console.log("File Extensions:", fileExtensions);

    const allFiles = [];

    //   const walk = async (dir) => {
    //     const files = await readDir(dir);

    //     for (const file of files) {
    //       const filePath = join(dir, file.path);

    //       if (file.children) {
    //         // Recursively walk into subdirectories
    //         await walk(filePath);
    //       } else {
    //         // Check if the file has a matching extension
    //         const fileExtension = extname(file.path);
    //         if (fileExtensions.includes(fileExtension)) {
    //           allFiles.push(filePath);
    //         }
    //       }
    //     }
    //   };

    //   await walk(searchPath);

    //   return allFiles;
    // }

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

    const entries = await readDir(filePath, { recursive: true });
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

    console.log("deduped", deduped);
    const files = deduped;
    return files;
  } catch (error) {
    console.error(error);
  }
}
