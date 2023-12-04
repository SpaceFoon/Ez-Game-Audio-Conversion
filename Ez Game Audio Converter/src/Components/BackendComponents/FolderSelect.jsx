// FolderSelect.jsx
import { open } from '@tauri-apps/api/dialog';
import { audioDir } from '@tauri-apps/api/path';

export async function handleSelectFolder(currentFilePath, setFilePath) {
  try {
    const defaultPath = currentFilePath || (await audioDir());
    const selectedPath = await open({
      multiple: false,
      recursive: true,
      directory: true,
      defaultPath: defaultPath,
    });
    console.log('Selected Path:', selectedPath);
    setFilePath(selectedPath);
  } catch (error) {
    console.error('Error selecting folder:', error);
  }
}