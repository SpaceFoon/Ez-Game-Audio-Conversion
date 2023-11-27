import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { message, confirm, open, ask } from '@tauri-apps/api/dialog';
import { appDataDir, audioDir, basename, join } from '@tauri-apps/api/path';
import { convertAudio2, createConversionList, searchFiles } from "./converter";
import { Input, Notification ,rem, Container, Grid, MantineProvider} from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import FilePathComponent from './Components/BackendComponents/FilePathComponent.jsx';
import FormatCheckboxComponent from './Components/BackendComponents/FormatCheckboxComponent';
import OutputFormatComponent from './Components/BackendComponents/OutputFormatComponent';
import LogsComponent from './Components/FrontendComponents/LogsComponent';

export default function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("testname");
  // async function greet() {
  //   const midiFilePath = "./tintin-on-the-moon.mid";

  //   // Invoke a Tauri command to play the MIDI file using the system's default player
  //   await invoke("play_midi_file", { path: midiFilePath });
  //   // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
  //   setGreetMsg(await invoke("greet", { name }));
  // }
  // function Demo() {
  //   return (
  //     <Button component={Link} to="/react-router"></Button>
  //   );
  // }
  const { ref, width, height } = useElementSize();
  // useEffect(() => { greet() }, []);
  let initialPath = null;
  let [filePath, setFilePath] = useState(`${initialPath}`);
  const [inputType, setinputType] = useState(['mp3', 'wav', 'flac']);
  let [bitrate, setBitrate] = useState(192);
  const [outputType, setOutputType] = useState(['ogg']);
  const [logs, setLogs] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [question, setQuestion] = useState('');
  const dialog = useRef(null);
  
  
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
    }
    setInitialFilePath();
  }, []);


  //

 <FilePathComponent filePath={filePath} handleSelectFolder={handleSelectFolder} />
  const handlePendingChanges = async (pendingChanges) => {
    let didpickall = '';
    

    for (let f of pendingChanges) {
      const responseActions = {
        o: () => {},
        oa: () => { didpickall = 'oa'; },
        r: () => { f.outputFile = f.outputFileCopy; },
        ra: () => { f.outputFile = f.outputFileCopy; didpickall = 'ra'; },
        s: () => { f.outputFile = 'skipped!'; },
        sa: () => { f.outputFile = 'skipped!'; didpickall = 'sa'; }
      };

      if (didpickall) {
        responseActions[didpickall]();
        console.log(responseActions[didpickall])
        continue;
      }

      const response =  await new Promise((res, rej) => {
        setQuestion(`what to do with file ${f.inputFile}?`);
        dialog.current.addEventListener('close', () => res(dialog.current.returnValue));
        dialog.current.showModal();
      });

      responseActions[response]();
       setPendingChanges([...pendingChanges, { inputFile: f.inputFile, outputFile: f.outputFile }]); 
       console.log(pendingChanges) 
      //pendingChanges.push({ inputFile: f.inputFile, outputFile: f.outputFile });
    }

 
};


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
  const handleDialogOption = (e) => {
    e.preventDefault();
    dialog.current.close(e.target.value);
  }

  return (
    <MantineProvider>
    <div className="container">
    <dialog ref={dialog}>
      <form>
        <p>{question}</p>
        <button value='o' onClick={handleDialogOption}>overwrite</button>
        <button value='oa' onClick={handleDialogOption}>overwrite all</button>
        <button value='r' onClick={handleDialogOption}>rename</button>
        <button value='ra' onClick={handleDialogOption}>rename all</button>
        <button value='s' onClick={handleDialogOption}>skip</button>
        <button value='sa' onClick={handleDialogOption}>skip all</button>
      </form>
    </dialog>
      <div><h1>EZ Game Audio Converter</h1></div>
      {greetMsg}
      <div className="container">
      <form>
        <fieldset>
          <legend>
            Source File Path:
          </legend>
          <input type="text" value={filePath} placeholder="select file path" />
          <br />
          <button type="button" onClick={handleSelectFolder}>Select Folder</button>
        </fieldset>
        </form>
        </div>


        <fieldset>
          <legend>Source Formats:</legend>

          <label htmlFor="mp3">
            <input
              id="imp3"
              type="checkbox"
              name="inputType"
              value="mp3"
              checked={inputType.includes("mp3")}
              onChange={() => handleInputChange("mp3")}
            />
            MP3

          </label>
          <label htmlFor="wav">
            <input
            id="iwav"
              type="checkbox"
              name="inputType"
              value="wav"
              checked={inputType.includes("wav")}
              onChange={() => handleInputChange("wav")}
            />
            WAV
          </label>

          <label htmlFor="flac">
            <input
              id="iflac"
              type="checkbox"
              name="inputType"
              value="flac"
              checked={inputType.includes("flac")}
              onChange={() => handleInputChange("flac")}
            />
            FLAC

          </label>
    <label htmlFor="m4a">
            <input
            id="im4a"
              type="checkbox"
              name="inputType"
              value="m4a"
              checked={inputType.includes("m4a")}
              onChange={() => handleInputChange("m4a")}
            />
            M4A
          </label>
              <label htmlFor="ogg">
            <input
            id="iogg"
              type="checkbox"
              name="inputType"
              value="ogg"
              checked={inputType.includes("ogg")}
              onChange={() => handleInputChange("ogg")}
            />
            OGG
          </label>
              <label htmlFor="midi">
            <input
            id="imidi"
              type="checkbox"
              name="inputType"
              value="midi"
              checked={inputType.includes("midi")}
              onChange={() => handleInputChange("midi")}
            />
            MIDI
          </label>

        </fieldset>

        <fieldset>
          <legend>
            Output Formats:
          </legend>
          <label htmlFor="ogg">
          <input className="checkbox"
            id="oogg"
            type="checkbox"
            name="outputType"
            value="ogg"
            checked={outputType.includes("ogg")}
            onChange={() => handleOutputChange("ogg")}
          />
            
            OGG</label>
          <label htmlFor="m4a">
          <input
            id="om4a"
            type="checkbox"
            name="outputType"
            value="m4a"
            checked={outputType.includes("m4a")}
            onChange={() => handleOutputChange("m4a")}
          />
            
            M4A</label>
                 <label htmlFor="wav">
          <input
            id="owav"
            type="checkbox"
            name="outputType"
            value="wav"
            checked={outputType.includes("wav")}
            onChange={() => handleOutputChange("wav")}
          />
            
            WAV</label>
                 <label htmlFor="flac">
          <input
            id="oflac"
            type="checkbox"
            name="outputType"
            value="flac"
            checked={outputType.includes("flac")}
            onChange={() => handleOutputChange("flac")}
          />
            
            FLAC</label>
                 <label htmlFor="mp3">
          <input
            id="omp3"
            type="checkbox"
            name="outputType"
            value="mp3"
            checked={outputType.includes("mp3")}
            onChange={() => handleOutputChange("mp3")}
          />
            MP3</label>
        </fieldset>
        <fieldset>
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
       
        {/* <button onClick={Demo}>Demo</button> */}
        </fieldset>


      
      <div>
 <button onClick={() => handleStart(pendingChanges)}>Start</button>     
  </div>

      <div className="retro-terminal-logs">
      <h2>Logs:</h2>
      {/* <Container size="responsive"> */}
      <Grid>
      <Grid.Col span={12}>
        <ul >
          {logs.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
        </Grid.Col>
        </Grid>
        {/* </Container> */}
        <div>Width: {width}, height: {height}</div>
      </div>
    </div>
    </MantineProvider>
  );
};
