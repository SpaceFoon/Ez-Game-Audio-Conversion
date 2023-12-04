import React, { useEffect, useRef, useState } from "react";
import { ask } from '@tauri-apps/api/dialog';
import { audioDir } from '@tauri-apps/api/path';
import { MantineProvider } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';

import FilePathComponent from './Components/FrontendComponents/FilePathComponent.jsx';
import InputFormatCheckboxComponent from './Components/BackendComponents/InputFormatComponent.jsx';
import OutputFormatComponent from './Components/BackendComponents/OutputFormatComponent.jsx';
import LogsComponent from './Components/FrontendComponents/LogsComponent.jsx';
import {handleSelectFolder} from './Components/BackendComponents/FolderSelect.jsx'
import {handlePendingChanges} from './Components/BackendComponents/PendingChangesComponent.jsx'

export default function App() {
  //   const midiFilePath = "./tintin-on-the-moon.mid";
  //   // Invoke a Tauri command to play the MIDI file using the system's default player
  //   await invoke("play_midi_file", { path: midiFilePath });
  //   // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
  //   setGreetMsg(await invoke("greet", { name }));
  // }
  const { ref, width, height } = useElementSize();

   let initialPath = null;
  // let [filePath, setFilePath] = useState(`${initialPath}`);

  const [inputType, setinputType] = useState(['mp3', 'wav', 'flac']);
  let [bitrate, setBitrate] = useState(192);
  const [outputType, setOutputType] = useState(['ogg']);
  const [logs, setLogs] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [question, setQuestion] = useState('');
  const dialog = useRef(null);

  const [filePath, setFilePath] = useState('');

  const handleSelect = async () => {
     await handleSelectFolder(filePath, setFilePath);
   };

// Function to set initialize file path
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

  const handleStart = async () => {
    const confirmed2 = await ask('Proceed with the conversion? Are you sure?', { title: 'Think about it', type: 'warning' });
    if (confirmed2) {
      if (!bitrate) bitrate = 192;
      const newLogs = [
        `File Path: ${filePath}`,
        `File Type: ${inputType.join(', ')}`,
        `Bitrate: ${bitrate}`,
        `Output Type: ${outputType.join(', ')}`,
      ];
      setLogs([...logs, ...newLogs]);
      handlePendingChanges(pendingChanges);

      // Use the list of pending changes for the conversion
      //await convertAudio2({ bitrate }, pendingChanges).then(response => {
      //  console.info('convertAudio2 results:', response);
      //});
    }
  };

  const handleInputChange = (value) => {
    console.log('file type change:', value);
    setinputType((current) => current.includes(value) ? current.filter(x => x !== value) : [...current, value]);
  };

  const handleOutputChange = (value) => {
    console.log('output type change:', value);
    setOutputType((current) => current.includes(value) ? current.filter(x => x !== value) : [...current, value]);
  };

    const handleDialogOption = (e) => {
    e.preventDefault();
    dialog.current.close(e.target.value);
  };
  //   const handleBitrateChange = (value) => {
  //   const newBitrate = value;
  //   if (newBitrate < 32 || newBitrate > 512) {
  //       // You can trigger a blinking effect or show a notification here
  //       // For simplicity, I'm using console.log
  //     console.log('Bitrate out of range!');
  //     newBitrate = 192;
  //     // You can also set a state variable to control the blinking effect
  //     // Example: setBitrateOutOfRange(true);
  //   }
  //   setBitrate(newBitrate);
  // };


  return (
    <MantineProvider>
      <div className="container">
        <dialog ref={dialog}>
          <form>
            <p>{question}</p>
            <button value='o' onClick={handleDialogOption}>Overwrite</button>
            <button value='oa' onClick={handleDialogOption}>Overwrite All</button>
            <button value='r' onClick={handleDialogOption}>Rename</button>
            <button value='ra' onClick={handleDialogOption}>Rename All</button>
            <button value='s' onClick={handleDialogOption}>Skip</button>
            <button value='sa' onClick={handleDialogOption}>Skip All</button>
          </form>
        </dialog>

        <div><h1>EZ Game Audio Converter</h1></div>

        <div className="container">
          <FilePathComponent filePath={filePath} handleSelectFolder={handleSelect} />
        </div>
        <fieldset>
          <legend>Source Formats:</legend>
          <InputFormatCheckboxComponent
            label="MP3"
            value="mp3"
            checked={inputType.includes('mp3')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="WAV"
            value="wav"
            checked={inputType.includes('wav')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="FLAC"
            value="flac"
            checked={inputType.includes('flac')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="M4A"
            value="m4a"
            checked={inputType.includes('m4a')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="OGG"
            value="ogg"
            checked={inputType.includes('ogg')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="MIDI"
            value="midi"
            checked={inputType.includes('midi')}
            onChange={handleInputChange} />
        </fieldset>

        <fieldset>
          <legend>
            Output Formats:
          </legend>
          <OutputFormatComponent
            label="OGG"
            value="ogg"
            checked={outputType.includes('ogg')}
            onChange={handleOutputChange} />
          <OutputFormatComponent
            label="M4A"
            value="m4a"
            checked={outputType.includes('m4a')}
            onChange={handleOutputChange} />
          <OutputFormatComponent
            label="WAV"
            value="wav"
            checked={outputType.includes('wav')}
            onChange={handleOutputChange} />
          <OutputFormatComponent
            label="FLAC"
            value="flac"
            checked={outputType.includes('flac')}
            onChange={handleOutputChange} />
          <OutputFormatComponent
            label="MP3"
            value="mp3"
            checked={outputType.includes('mp3')}
            onChange={handleOutputChange} />
        </fieldset>
        {/* <fieldset>
              <legend>
                Advanced Options:
              </legend>
            <label htmlFor="bitrate">Bitrate:</label>
            <input
              id="bitrate"
              type="text"
              name="setBitrate"
              value={bitrate}
              onChange={(e) => setBitrate(e.target.value)}
            />
           
            </fieldset> */}

        <div>
          <button onClick={() => handleStart(pendingChanges)}>Start</button>
        </div>

        <LogsComponent logs={logs} width={width} height={height} />
      </div>
    </MantineProvider>
  );
}
