//Home.jsx
import { useEffect, useState } from "react";
import { audioDir } from '@tauri-apps/api/path';
import { MantineProvider } from '@mantine/core';
import { Link } from 'react-router-dom';
import FilePathComponent from '../Components/UI/FilePathComponent';
import CheckBoxes from '../Components/UI/CheckBoxes';
import StartButton from "../Components/UI/StartButton";

const Home = () =>{
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
       </div>
       <Link to="/Working">Go to Working</Link>
    </MantineProvider>
)}
export default Home