import { useState } from "react";
import logo from "./assets/logoplain.png";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.scss";

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
    <div className="logo-container">
    <div className="container">
      <div><h1>EZ Game Audio Converter</h1></div>
    <form>
      <div>
        <label>
          File Path:
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
          />
          <button onClick={handleSelectFolder}>Select Folder</button>
        </label>
      </div>

      <div>
        <label>
          File Type:
          <input
            type="radio"
            name="fileType"
            value="mp3"
            checked={fileType === "mp3"}
            onChange={() => handleOutputTypeChange("mp3")}
          />{" "}
          MP3
          <input
            type="radio"
            name="fileType"
            value="wav"
            checked={fileType === "wav"}
            onChange={() => handleOutputTypeChange("wav")}
          />{" "}
          WAV
        </label>
      </div>

      <div>
        <label>
          Output Type:
          <input className="radio button"
            type="radio"
            name="outputType"
            value="ogg"
            checked={outputType === "ogg"}
            onChange={() => handleFileTypeChange("ogg")}
          />{" "}
          OGG
          <input
            type="radio"
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
    </div>
  );
};


export default App;
