import PropTypes from 'prop-types';

const StartButton = ({filePath, inputType, outputType, HandleStart}) => (
    <button type="button" onClick={() => HandleStart(
            filePath, inputType, outputType)}>
            Start
    </button>
);
StartButton.propTypes = {
  filePath: PropTypes.string.isRequired,
  inputType: PropTypes.arrayOf(PropTypes.string).isRequired,
  outputType: PropTypes.arrayOf(PropTypes.string).isRequired,
  HandleStart: PropTypes.func.isRequired,
}
export default StartButton