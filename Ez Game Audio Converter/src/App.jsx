import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { message, confirm, open, ask } from '@tauri-apps/api/dialog';
import { appDataDir, audioDir, basename, join } from '@tauri-apps/api/path';

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }
  let filePath;
  let [fileType, setFileType] = useState("");
  let [bitrate, setBitrate] = useState("");
  let [outputType, setOutputType] = useState("");
  let [logs, setLogs] = useState([]);

  const handleStart = async () => {
    const confirmed2 = await ask('This action cannot be reverted. Are you sure?', { title: 'Think about it', type: 'warning' });
    // Perform any necessary actions with the selected options
    // For now, just log the selected options
    if (confirmed2){
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
      const dir = audioDir()
      filePath = await open({
        //multiple: true, one day
        defaultPath: `${dir}`,
        multiple: false,
        recursive: true,
        directory: true,
      });
    } catch (error) {
      console.error("Error selecting folder:", error);
    }

  };
 
  const handleFileTypeChange = (value) => {
    setFileType(value);
  };

  const handleOutputTypeChange = (value) => {
    setOutputType(value);
  };
  return (
    
    <div className="container">
      <div><h1>EZ Game Audio Converter</h1></div>
      <div className="container"></div>
    <form>
      <div>
        <label>
          Source File Path:
          <button onClick={handleSelectFolder}>Select Folder</button>
        </label>
      </div>

      <div>
        <label>
          Source Formats:
          <input
            type="checkbox"
            name="fileType"
            value="mp3"
            checked={fileType === "mp3"}
            onChange={() => handleOutputTypeChange("mp3")}
          />{" "}
          MP3
          <input
            type="checkbox"
            name="fileType"
            value="wav"
            checked={fileType 
              === "wav"}
            onChange={() => handleOutputTypeChange("wav")}
          />{" "}
          WAV
          <input
            type="checkbox"
            name="fileType"
            value="flac"
            checked={fileType 
              === "flac"}
            onChange={() => handleOutputTypeChange("flac")}
          />{" "}
          FLAC
        </label>
      </div>

      <div >
        <label>
          Output Formats:
          <input className="checkbox"
            type="checkbox"
            name="outputType"
            value="ogg"
            checked={outputType === "ogg"}
            onChange={() => handleFileTypeChange("ogg")}
          />{" "}
          OGG
          <input
            type="checkbox"
            name="outputType"
            value="m4a"
            checked={outputType === "m4a"}
            onChange={() => handleFileTypeChange("m4a")}
          />{" "}
          M4A
        </label>
        <div className="enterBitrate"> 
          <label className="enterBitrate">
          Bitrate:
          <input
            type="text"
            name="setBitrate"
            value="192"
            onChange={() => setBitrate("192")}
          />{" "}
          
       
        </label>
        </div>
       
      </div>
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
