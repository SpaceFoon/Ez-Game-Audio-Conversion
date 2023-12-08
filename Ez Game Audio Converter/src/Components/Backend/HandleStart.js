 //HandleStart.jsx
 import { useState } from 'react';
 import { join, } from '@tauri-apps/api/path';
 import { ask } from '@tauri-apps/api/dialog'
 import HandlePendingChanges from './PendingChangesComponent'
const HandleStart = async ({
  
      filePath,
      inputType,
      outputType,
      
  
}) => {
  const [logs, setLogs] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([])
  const confirmed = await ask('Proceed with the conversion? Are you sure?', {
    title: 'Think about it',
    type: 'warning'
  });

  if (confirmed) {
    // if (!bitrate) bitrate = 192;
    const newLogs = [
      `Source Path: ${filePath}`,
      `Input Type: ${inputType = join(inputType)}`,
      `Output Type: ${outputType = join(outputType)}`,
      // `Bitrate: ${bitrate}`,
    ];

    setLogs(logs ? [...logs, ...newLogs] : newLogs);

    HandlePendingChanges(pendingChanges, setPendingChanges );
    console.log(pendingChanges, "Pending Changes");

    return { pendingChanges, logs };
  }
};

export default HandleStart;
