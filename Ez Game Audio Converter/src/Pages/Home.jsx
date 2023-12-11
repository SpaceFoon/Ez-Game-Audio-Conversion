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
  const [outputType, setOutputType] = useState(['ogg']);
  const [filePath, setFilePath] = useState('');


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
      // settings={settings}
      // setSettings={setSettings}
      filePath={filePath}
      inputType={inputType}
      outputType={outputType}
    />
    </div>
    </div>
    <Link to="/Working">Go to Working</Link>
  </MantineProvider>
)}
export default Home