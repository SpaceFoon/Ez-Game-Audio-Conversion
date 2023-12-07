//StartButton.jsx
import { useState } from 'react';
import PropTypes from 'prop-types';
import HandleStart from '../BackendComponents/HandleStart'; // Adjust the path accordingly

const StartButton = ({ filePath, inputType, outputType, }) => {
  const [logs, setLogs] = useState([]);

  const handleStartClick = async () => {
    // Call HandleStart with the necessary parameters
    const { newLogs } = await HandleStart({
      filePath,
      inputType,
      outputType,
      logs,
      setLogs,
      
    });

    // Do something with pendingChanges if needed

    // Update logs using setLogs callback
    setLogs(prevLogs => [...prevLogs, ...newLogs]);
  };

  return (
    <button type="button" onClick={handleStartClick}>
      Start
    </button>
  );
};

StartButton.propTypes = {
  filePath: PropTypes.string.isRequired,
  inputType: PropTypes.arrayOf(PropTypes.string).isRequired,
  outputType: PropTypes.arrayOf(PropTypes.string).isRequired,
  HandleStart: PropTypes.func.isRequired,
};

export default StartButton;
