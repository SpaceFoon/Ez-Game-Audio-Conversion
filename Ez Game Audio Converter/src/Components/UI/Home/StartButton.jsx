//StartButton.jsx
import PropTypes from 'prop-types';
import { useNavigate } from "react-router-dom";
import searchFiles from '../../Backend/searchFiles';

const StartButton = ({filePath, inputType, outputType}) => {
  console.log('filePath:', filePath);
  const navigate = useNavigate();
  const startConversion = async () => {
    console.log("Start Button", filePath, inputType, outputType)
     const { deduped, removed } = await searchFiles(filePath, inputType);
    navigate("/Working", { state:  {filePath, inputType, outputType, deduped, removed} });
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
  searchFiles: PropTypes.func,
};

export default StartButton;