//StartButton.jsx
import handleStart from '../Backend/handleStart';
import PropTypes from 'prop-types';

const StartButton = ({ filePath, inputType, outputType, logs, setLogs, pendingChanges, setPendingChanges }) => {
  const startConversion = async () => {
    const result = await handleStart({ filePath, inputType, outputType, logs, setLogs, pendingChanges, setPendingChanges });
    // Access the result if needed
    console.log(result);
  };

  return (
    <button type="button" onClick={startConversion}>
      Start
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
