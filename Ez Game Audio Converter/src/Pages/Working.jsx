//WorkingPage.jsx
import PropTypes from 'prop-types';
import { MantineProvider } from '@mantine/core';
import { Link } from 'react-router-dom';
import LogsComponent from '../Components/UI/LogsComponent';
import { useEffect, useState } from "react";

//import {logs} from '../Pages/Home'
const WorkingPage = ({ filePath, inputType, outputType }) => {
  const [settings, setSettings] = useState([]);
  console.log("settings1", {settings})
  let progress = null

  const arrayToString = (array) => {
  return array
    ? array.reduce((acc, value) => acc + (acc.length ? ', ' : '') + value, '')
    : '';
  };

  useEffect(() => {
    const inputTypeString = arrayToString(inputType + ', ');
    const outputTypeString = arrayToString(outputType + ', ');
    const newSettings = [
      `Source Path: ${filePath}`,
      `Input Type: ${inputTypeString}`,
      `Output Type: ${outputTypeString}`,
    ];

    console.log('Before SetLogs: ', settings);

    setSettings(newSettings);

    console.log('After SetLogs: ', settings);
  }, [settings, filePath, inputType, outputType,]);
  
   return(
   <MantineProvider>
      <div className="container"><h2>Working Screen</h2></div>
      
      <LogsComponent settings={settings}/>

      <div className="container"><progress value={progress} /></div>

      <div className="container"><Link to="/Home">Go to Home</Link></div>
      <div className="container"><Link to="/Finished">Go to Finished</Link></div>
   </MantineProvider>
   )
}
WorkingPage.propTypes = {
  filePath: PropTypes.string.isRequired,
  inputType: PropTypes.arrayOf(PropTypes.string).isRequired,
  outputType: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default WorkingPage