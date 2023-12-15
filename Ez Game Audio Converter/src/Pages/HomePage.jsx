//HomePage.jsx
import { useEffect, useState } from "react";
import { audioDir } from '@tauri-apps/api/path';
import FilePathComponent from '../Components/UI/Home/FilePathComponent';
import CheckBoxes from '../Components/UI/Home/CheckBoxes';
import StartButton from "../Components/UI/Home/StartButton";

const HomePage = () =>{
  //Set buttons to most common audio formats.
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
  <>
    <div className="container">
    <div className="container">
      <FilePathComponent filePath={filePath} setFilePath = {setFilePath}/>
    </div>
 <div className="container">
    <CheckBoxes
      inputType={inputType}
      outputType={outputType}
      setInputType={setInputType}
      setOutputType={setOutputType}
    />
</div>
    <div className="container">
    <StartButton
      filePath={filePath}
      inputType={inputType}
      outputType={outputType}
    />
    </div>
    </div>
  </>
)}
export default HomePage