//Settings.jsx
import PropTypes from 'prop-types';
const Settings = ({ settings }) => {
  
    let { filePath, inputType, outputType } = settings;

    return (
    <div className="titles">
      <fieldset>
      <legend>Batch Settings:</legend>
      <ul>
        <li>File Path: {filePath}</li>
        <li>Input Type: {inputType}</li>
        <li>Output Type: {outputType}</li>
      </ul>
      </fieldset>
    </div>
  );
};
Settings.propTypes = {
  settings: PropTypes.shape({
    filePath: PropTypes.string.isRequired,
    inputType: PropTypes.string.isRequired,
    outputType: PropTypes.string.isRequired,
  }).isRequired,
};
export default Settings;