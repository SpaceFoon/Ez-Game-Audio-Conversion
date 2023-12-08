//StartButton.jsx
import HandleStart from '../Backend/HandleStart'
const StartButton = () => {
  return (
    <button type="button" onClick={HandleStart}>
      Start
    </button>
  );
};

StartButton.propTypes = {
  // filePath: PropTypes.string.isRequired,
  // inputType: PropTypes.arrayOf(PropTypes.string).isRequired,
  // outputType: PropTypes.arrayOf(PropTypes.string).isRequired,
  // HandleStart: PropTypes.func.isRequired,
};

export default StartButton;
