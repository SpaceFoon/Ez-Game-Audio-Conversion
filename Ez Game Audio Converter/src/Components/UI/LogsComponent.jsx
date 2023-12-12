//LogsComponent.jsx
import PropTypes from 'prop-types';
const LogsComponent = ({ settings }) => {
  
    let { filePath, inputType, outputType } = settings;

    return (
    <div className="retro-terminal-logs">
      <h2>User Settings:</h2>
      <ul>
        <li>File Path: {filePath}</li>
        <li>Input Type: {inputType}</li>
        <li>Output Type: {outputType}</li>
      </ul>
      <div>{/* Width: {width}, height: {height} */}</div>
    </div>
  );
};
LogsComponent.propTypes = {
  settings: PropTypes.shape({
    filePath: PropTypes.string.isRequired,
    inputType: PropTypes.string.isRequired,
    outputType: PropTypes.string.isRequired,
  }).isRequired,
};
export default LogsComponent;