import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { message, confirm, open, ask } from '@tauri-apps/api/dialog';
import { appDataDir, audioDir, basename, join } from '@tauri-apps/api/path';

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("testname");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  useEffect(() => {greet()}, []);

  const [filePath, setFilePath] = useState("");
  const [fileType, setFileType] = useState(`[...]`);
  const [bitrate, setBitrate] = useState("");
  const [outputType, setOutputType] = useState("");
  const [logs, setLogs] = useState([]);

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
      let dir = audioDir()
      const [fPath] = await open({
        //multiple: true, one day
        defaultPath: `${dir}`,
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
    setFileType(value);
  };

  const handleOutputTypeChange = (value) => {
    setOutputType(value);
  };
  return (
    
    <div className="container">
      <div><h1>EZ Game Audio Converter</h1></div>
      {greetMsg}
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
            checked={fileType.includes("mp3")}
            onChange={() => handleFileTypeChange("mp3")}
          />{" "}
          MP3
          <input
            type="checkbox"
            name="fileType"
            value="wav"
            checked={fileType.includes("wav")}
            onChange={() => handleFileTypeChange("wav")}
          />{" "}
          WAV
          <input
            type="checkbox"
            name="fileType"
            value="flac"
            checked={fileType.includes("flac")}
            onChange={() => handleFileTypeChange("flac")}
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
            checked={outputType.includes("ogg")}
            onChange={() => handleOutputTypeChange("ogg")}
          />{" "}
          OGG
          <input
            type="checkbox"
            name="outputType"
            value="m4a"
            checked={outputType.includes("m4a")}
            onChange={() => handleOutputTypeChange("m4a")}
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
