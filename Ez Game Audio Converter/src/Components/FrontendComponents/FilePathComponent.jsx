//FilePathComponent,jsx
const FilePathComponent = ({ filePath, handleSelectFolder }) => (
  <div>
    <fieldset>
      <legend>Source File Path:</legend>
      <input type="text" value={filePath} placeholder="select file path" />
      <br />
      <button type="button" onClick={handleSelectFolder}>
        Select Folder
      </button>
    </fieldset>
  </div>
);

export default FilePathComponent;