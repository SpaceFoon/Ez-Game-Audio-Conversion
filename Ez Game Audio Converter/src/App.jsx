//App.jsx
import { useEffect, useState } from "react";
import { audioDir } from '@tauri-apps/api/path';
import { MantineProvider } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';

import FilePathComponent from './Components/UI/FilePathComponent';
import CheckBoxes from './Components/UI/CheckBoxes';
import StartButton from "./Components/UI/StartButton";
import LogsComponent from './Components/UI/LogsComponent'
export default function App() {
  //   const midiFilePath = "./tintin-on-the-moon.mid";
  //   // Invoke a Tauri command to play the MIDI file using the system's default player
  //   await invoke("play_midi_file", { path: midiFilePath });
  //   // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
  //   setGreetMsg(await invoke("greet", { name }));
  // }
  const {width, height } = useElementSize();

  const [inputType, setInputType] = useState(['mp3', 'wav', 'flac']);
  console.log(inputType)
  const [outputType, setOutputType] = useState(['ogg']);
  console.log(outputType)
  //let [bitrate, setBitrate] = useState(192);
  const [filePath, setFilePath] = useState('');
  const [logs, setLogs] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);


  // Function to set initialize file path
  useEffect(() => {
    //Sets default filepath to Windows music folder.
    const setInitialFilePath = async () => {
      try {
        let initialPath = await audioDir();
        setFilePath(initialPath);
      } catch (error) {
        console.error('Error getting initial path:', error);
      }
    };
    setInitialFilePath();
  }, [])

  return (
    <MantineProvider>
      <div className="container">
    
        <><h1>EZ Game Audio Converter</h1></>

        <div className="container">
          <FilePathComponent filePath={filePath} setFilePath = {setFilePath}/>
        </div>

        <CheckBoxes
        inputType={inputType}
        outputType={outputType}
        setInputType={setInputType}
        setOutputType={setOutputType}
      />
        <div>
  <StartButton
  filePath={filePath}
  inputType={inputType}
  outputType={outputType}
  logs={logs}
  setLogs={setLogs}
  pendingChanges={pendingChanges}
  setPendingChanges={setPendingChanges}
/>
      </div>
        <div><progress value={null} /></div>

          <LogsComponent logs={logs} width={width} height={height} />

      </div>
    </MantineProvider>
  );
}
