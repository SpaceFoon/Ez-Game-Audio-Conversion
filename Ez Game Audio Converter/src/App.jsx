import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from '@tauri-apps/api/dialog';
import { appDataDir } from '@tauri-apps/api/path';

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  const [filePath, setFilePath] = useState("");
  const [fileType, setFileType] = useState("");
  const [outputType, setOutputType] = useState("");
  const [logs, setLogs] = useState([]);

  const handleStart = () => {
    // Perform any necessary actions with the selected options
    // For now, just log the selected options
    const newLogs = [
      `File Path: ${filePath}`,
      `File Type: ${fileType}`,
      `Output Type: ${outputType}`,
    ];
    setLogs([...logs, ...newLogs]);
  };
  const handleSelectFolder = async () => {
    try {
      const response = await window.__TAURI__.tauri.shell.open("openDirectoryDialog");
      if (response && response.payload) {
        // Tauri's `openDirectoryDialog` returns an object; we'll use the dialog property
        setFilePath(response.payload.dialog);
      }
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
          
          <button onClick={open}>Select Folder</button>
        </label>
      </div>

      <div>
        <label>
          File Type:
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
          Output Type:
          <input className="radio button"
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
