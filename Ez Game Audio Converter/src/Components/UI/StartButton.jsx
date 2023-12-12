//StartButton.jsx
//import {useEffect} from 'react'
import PropTypes from 'prop-types';
import { useNavigate } from "react-router-dom";
// import { ask } from "@tauri-apps/api/dialog";
// import { Button, Text } from '@mantine/core';
// import { modals } from '@mantine/modals';
// import handlePendingChanges from "./handlePendingChanges";


const StartButton = ({filePath, inputType, outputType}) => {
  
  const navigate = useNavigate();
  const startConversion = () => {
  navigate("/Working", { state:  {filePath, inputType, outputType} });
    console.log("Start Button",filePath, inputType, outputType)
};

  return (
    <button onClick={startConversion}>
      Next
    </button>
  );
};

StartButton.propTypes = {
  filePath: PropTypes.string.isRequired,
  inputType: PropTypes.arrayOf(PropTypes.string).isRequired,
  outputType: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default StartButton;
