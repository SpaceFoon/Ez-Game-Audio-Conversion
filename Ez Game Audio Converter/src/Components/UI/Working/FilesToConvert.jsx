//FilesToConvert.jsx
import searchFiles from "../../Backend/searchFiles";
const FilesToConvert = ({files}) => {
    const list = files;
    return(
  <div className="container">
    <h3>Deduped List:</h3>
    <ul>
      {list.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  </div>
);}

export default FilesToConvert;