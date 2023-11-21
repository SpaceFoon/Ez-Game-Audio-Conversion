import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { message, confirm, open, ask } from '@tauri-apps/api/dialog';
import { audioDir, basename, join } from '@tauri-apps/api/path';
import { Midi } from "@tonejs/midi";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("testname");

  async function greet() {
    const midiData = await fetch("./tintin-on-the-moon.mid").then(response => response.arrayBuffer());
    const midiFilePath = "path/to/your/midi/file.mid";

    // Invoke a Tauri command to play the MIDI file using the system's default player
    await invoke("playMidiFile", { path: midiFilePath });
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  useEffect(() => { greet() }, []);

  let [filePath, setFilePath] = useState("");
  const [fileType, setFileType] = useState([]);
  let [bitrate, setBitrate] = useState('192');
  const [outputType, setOutputType] = useState("");
  const [logs, setLogs] = useState([]);

  const handleStart = async () => {
    const confirmed2 = await ask('This action cannot be reverted. Are you sure?', { title: 'Think about it', type: 'warning' });
    // Perform any necessary actions with the selected options
    // For now, just log the selected options
    if (confirmed2){
      if(!bitrate)bitrate = 192;
      if(!filePath)filePath = await audioDir();
    const newLogs = [
      `File Path: ${filePath}`,
      `File Type: ${fileType}`,
      `Bitrate: ${bitrate}`,
      `Output Type: ${outputType}`,
    ];
    setLogs([...logs, ...newLogs]);
    }
  };

  const handleSelectFolder = async () => {
    try {
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

  const handleFileTypeChange = (value) => {
    console.log('file type change:', value);
    setFileType((current) => current.includes(value) ? current.filter(x => x !== value) : [...current, value]);
  };

  const handleOutputTypeChange = (value) => {
    console.log('output type change:', value);
    setOutputType((current) => current.includes(value) ? current.filter(x => x !== value) : [...current, value]);
  };
  return (

    <div className="container">
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
        </fieldset>


      </form>
      <div>
        <button onClick={handleStart}>Start</button>
      </div>

      <div className="retro-terminal-logs">
        <h2>Logs:</h2>
        <ul>
          {logs.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    </div>

  );
};


export default App;
