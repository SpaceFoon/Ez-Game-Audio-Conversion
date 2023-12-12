//StartButton.jsx
import PropTypes from 'prop-types';
import { useNavigate } from "react-router-dom";
import searchFiles from '../../Backend/searchFiles';

const StartButton = ({filePath, inputType, outputType}) => {
  console.log('filePath:', filePath);
  const navigate = useNavigate();
  const startConversion = async () => {
    // Call searchFiles before navigating
    console.log("Start Button", filePath, inputType, outputType)
    await searchFiles(filePath, inputType);
    navigate("/Working", { state:  {filePath, inputType, outputType} });
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
  //searchFiles: PropTypes.func.isRequired, // Add searchFiles to propTypes
};

export default StartButton;