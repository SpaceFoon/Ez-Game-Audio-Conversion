//FilePathComponent,jsx

import PropTypes from 'prop-types';

const FilePathComponent = ({ filePath, handleSelectFolder }) => (
  <div>
    <fieldset>
      <legend>Source File Path:</legend>
      <input type="text" value={filePath} placeholder="Select file path" readOnly />
      <br />
      <button type="button" onClick={() => handleSelectFolder()}>
        Select Folder
      </button>
    </fieldset>
  </div>

);
FilePathComponent.propTypes = {
  filePath: PropTypes.string.isRequired,
  handleSelectFolder: PropTypes.func.isRequired,
};
export default FilePathComponent;