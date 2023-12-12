//FilePathComponent,jsx

import propTypes from 'prop-types';
import {handleSelectFolder} from '../../Backend/folderSelect'



const FilePathComponent = ({ filePath, setFilePath}) => {
    const handleSelect = async () => {
      await handleSelectFolder({filePath, setFilePath});
    };
    return(
  <div >
    <fieldset>
      <legend>Source File Path:</legend>
      <input type="text" value={filePath} placeholder="Select Source File Path" readOnly />
      <br />
      <button type="button" onClick={() => handleSelect({filePath, setFilePath})}>
        Select Folder
      </button>
    </fieldset>
  </div>

);}
FilePathComponent.propTypes = {
  filePath: propTypes.string.isRequired,
  setFilePath: propTypes.func.isRequired
};
export default FilePathComponent;