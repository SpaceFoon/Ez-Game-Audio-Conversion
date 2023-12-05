 import { useState } from 'react'
 import { join, } from '@tauri-apps/api/path';
 import { ask } from '@tauri-apps/api/dialog'
 
 const HandleStart = async (filePath, inputType, outputType,
    pendingChanges, bitrate, HandlePendingChanges) => {
         const [logs, setLogs] = useState([]);

    const confirmed = await ask('Proceed with the conversion? Are you sure?', { title: 'Think about it', type: 'warning' });
    if (confirmed) {
      if (!bitrate) bitrate = 192;
      const newLogs = [
        `Source Path: ${filePath}`,
        `Input Type: ${inputType = join(inputType)}`,
        `Output Type: ${outputType = join(outputType)}`,
        `Bitrate: ${bitrate}`,
        
      ];
      setLogs([...logs, ...newLogs]);
      HandlePendingChanges(pendingChanges);
      console.log(pendingChanges, "Pending Changes")
      return pendingChanges;

      // Use the list of pending changes for the conversion
      //await convertAudio2({ bitrate }, pendingChanges).then(response => {
      //  console.info('convertAudio2 results:', response);
      //});
    }
  }
  export default HandleStart
