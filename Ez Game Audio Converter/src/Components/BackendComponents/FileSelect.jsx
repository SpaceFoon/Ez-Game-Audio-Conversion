//  FileSelect.jsx
  import React, { useEffect, useRef, useState } from "react";
import { open, ask } from '@tauri-apps/api/dialog';
import { audioDir } from '@tauri-apps/api/path';
  let initialPath = null;
  let [filePath, setFilePath] = useState(`${initialPath}`);
  
  export async function  handleSelectFolder(filePath, setFilePath) {
    try {
      if (!filePath) filePath = audioDir();
      // let dir = audioDir()
      const fPath = await open({
        //multiple: true, one day
        //defaultPath: `${dir}`,
        multiple: false,
        recursive: true,
        directory: true,
      });
      console.log('fPath', fPath);
      setFilePath(fPath);
    } catch (error) {
      console.error("Error selecting folder:", error);
    }
  };

export async function initFilePath(){
    // Function to set initialize some things
  useEffect(() => {
    //Sets default filepath to Windows music folder.
    const setInitialFilePath = async () => {
      try {
        initialPath = await audioDir();
        setFilePath(initialPath);
      } catch (error) {
        console.error('Error getting initial path:', error);
      };
    };
    setInitialFilePath();
  }, []);
}
