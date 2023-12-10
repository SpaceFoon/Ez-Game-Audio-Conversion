//StartButton.jsx
//import {useEffect} from 'react'
import PropTypes from 'prop-types';
import { useNavigate } from "react-router-dom";
import { ask } from "@tauri-apps/api/dialog";
import { Button, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
// import handlePendingChanges from "./handlePendingChanges";

const arrayToString = (array) => {
  return array
    ? array.reduce((acc, value) => acc + (acc.length ? ", " : "") + value, "")
    : "";
};

const StartButton = ({ filePath, inputType, outputType, logs, setLogs, pendingChanges, setPendingChanges }) => {
  const navigate = useNavigate();



  const startConversion = async () => {
    
// const confirmed = await ask("Proceed with the conversion? Are you sure?", {
//     title: "Are you sure?",
//     type: "warning",
//   });

  // if (confirmed) {
    navigate("/Working")
    // if (!bitrate) bitrate = 192;
    const inputTypeString = arrayToString(inputType);
    const outputTypeString = arrayToString(outputType);

    const newLogs = [
      `Source Path: ${filePath}`,
      `Input Type: ${inputTypeString}`,
      `Output Type: ${outputTypeString}`,
      // `Bitrate: ${bitrate}`,
    ];
    setLogs(logs ? [...logs, ...newLogs] : newLogs);
        console.log('Start Button: ',logs, newLogs,);


    // handlePendingChanges(pendingChanges, setPendingChanges);
    //console.log(pendingChanges, "Pending Changes");

    // return { pendingChanges, logs };
  // }
    
    
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
  logs: PropTypes.array.isRequired,
  setLogs: PropTypes.func.isRequired,
  pendingChanges: PropTypes.array.isRequired,
  setPendingChanges: PropTypes.func.isRequired,
};

export default StartButton;
