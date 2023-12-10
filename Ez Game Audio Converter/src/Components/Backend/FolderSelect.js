// FolderSelect.jsx
import { open } from "@tauri-apps/api/dialog";
import { audioDir } from "@tauri-apps/api/path";

// In the future support copy and pasting source path
// import { readText } from '@tauri-apps/api/clipboard'; Gets the clipboard content as plain text.
// const clipboardText = await readText();

export async function handleSelectFolder({ currentFilePath, setFilePath }) {
  try {
    const defaultPath = currentFilePath || (await audioDir());
    const selectedPath = await open({
      multiple: false,
      recursive: true,
      directory: true,
      defaultPath: defaultPath,
    });
    console.log("Selected Path:", selectedPath);
    if (!selectedPath) return;
    setFilePath(selectedPath);
  } catch (error) {
    console.error("Error selecting folder:", error);
  }
}
