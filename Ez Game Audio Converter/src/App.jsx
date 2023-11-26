import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { message, confirm, open, ask } from '@tauri-apps/api/dialog';
import { appDataDir, audioDir, basename, join } from '@tauri-apps/api/path';
import { convertAudio2, createConversionList, searchFiles } from "./converter";
import { Input, Notification ,rem, Container, Grid, MantineProvider} from '@mantine/core';
import { useElementSize } from '@mantine/hooks';


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

  function Demo() {
    return (
      <Button component={Link} to="/react-router"></Button>
    );
  }
  const { ref, width, height } = useElementSize();
  // useEffect(() => { greet() }, []);
  let initialPath = null;
  let [filePath, setFilePath] = useState(`${initialPath}`);
  const [fileType, setFileType] = useState(['mp3', 'wav', 'flac']);
  let [bitrate, setBitrate] = useState(192);
  const [outputType, setOutputType] = useState(['ogg']);
  const [logs, setLogs] = useState([]);
  const [files, setFiles] = useState([]);

  const [question, setQuestion] = useState('');
  const dialog = useRef(null);
  
// Function to set initialize some things
  useEffect(() => {
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

  const handleSelectFolder = async () => {
    try {
        if(!filePath)filePath = audioDir();
      // let dir = audioDir()
      const fPath = await open({
        //multiple: true, one day
        // defaultPath: `${dir}`,
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


  useEffect(() => {
    const doit = async () => await searchFiles(filePath, fileType);
    doit().then(files => createConversionList(outputType, files))
    .then(async conList => {
      
      let didpickall = '';
      for(let f of conList) {
        const responseActions = {
          o: () => {},
          oa: () => { didpickall = 'oa' },
          r: () => { f.outputFile = f.outputFileCopy;},
          ra: () => { f.outputFile = f.outputFileCopy; didpickall = 'ra';},
          s: () => { f.outputFile = 'skipped!';},
          sa: () => { f.outputFile = 'skipped!'; didpickall = 'sa'; }
        };
        if(didpickall) {
          responseActions[didpickall]();
          continue;
        }
        const response = await new Promise((res, rej) => {
          setQuestion(`what to do with file ${f.inputFile}?`)
          dialog.current.addEventListener('close', () => res(dialog.current.returnValue))
          dialog.current.showModal();
        });
        console.log('response', response);
        responseActions[response]();
      }
      return conList
    })
    .then(list => setFiles(list));
  }, [filePath, fileType, outputType])

  // useEffect(() => {
  //   const doit = async () => await createConversionList(outputType, files);
  //   doit().then(async conList => {

      
  //   });
  // }, [outputType])


  const handleStart = async () => {
    const confirmed2 = await ask('Proceed with the conversion? Are you sure?', { title: 'Think about it', type: 'warning' });
    setStartClicked(true);
    // Perform any necessary actions with the selected options
    // For now, just log the selected options
    if (confirmed2){
      if(!bitrate)bitrate = 192;
    const newLogs = [
      `File Path: ${filePath}`,
      `File Type: ${fileType.join(', ')}`,
      `Bitrate: ${bitrate}`,
      `Output Type: ${outputType.join(', ')}`,
    ];
    setLogs([...logs, ...newLogs]);

    await convertAudio2({bitrate}, files).then(response => {
      console.info('convertAudio2 results:', response);
    })

    }
  };


  const handleFileTypeChange = (value) => {
    console.log('file type change:', value);
    setFileType((current) => current.includes(value) ? current.filter(x => x !== value) : [...current, value]);
  };

  const handleOutputTypeChange = (value) => {
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
      <div className="container"></div>
      <form>
        <fieldset>
          <legend>
            Source File Path:
          </legend>
          <input type="text" readOnly value={filePath} placeholder="select file path" />
          <br />
          <button type="button" onClick={handleSelectFolder}>Select Folder</button>
        </fieldset>


        <fieldset>
          <legend>Source Formats:</legend>

          <label htmlFor="mp3">
            <input
              id="mp3"
              type="checkbox"
              name="fileType"
              value="mp3"
              checked={fileType.includes("mp3")}
              onChange={() => handleFileTypeChange("mp3")}
            />
            MP3

          </label>
          <label htmlFor="wav">
            <input
            id="wav"
              type="checkbox"
              name="fileType"
              value="wav"
              checked={fileType.includes("wav")}
              onChange={() => handleFileTypeChange("wav")}
            />
            WAV
          </label>

          <label htmlFor="flac">
            <input
              id="flac"
              type="checkbox"
              name="fileType"
              value="flac"
              checked={fileType.includes("flac")}
              onChange={() => handleFileTypeChange("flac")}
            />
            FLAC

          </label>


        </fieldset>

        <fieldset>
          <legend>
            Output Formats:
          </legend>
          <label htmlFor="ogg">
          <input className="checkbox"
            id="ogg"
            type="checkbox"
            name="outputType"
            value="ogg"
            checked={outputType.includes("ogg")}
            onChange={() => handleOutputTypeChange("ogg")}
          />
            
            OGG</label>
          <label htmlFor="m4a">
          <input
            id="m4a"
            type="checkbox"
            name="outputType"
            value="m4a"
            checked={outputType.includes("m4a")}
            onChange={() => handleOutputTypeChange("m4a")}
          />
            
            M4A</label>

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
       
        <button onClick={Demo}>Demo</button>
        </fieldset>


      </form>
      <div>
        <button onClick={handleStart}>Start</button>
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
