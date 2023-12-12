//WorkingPage.jsx
import { MantineProvider } from '@mantine/core';
import { Link, useLocation  } from 'react-router-dom';
import Settings from '../Components/UI/Working/Settings';
import FilesToConvert from '../Components/UI/Working/FilesToConvert';
import RemovedFiles from '../Components/UI/Working/RemovedFiles';
import ConvertButton from '../Components/UI/Working/ConvertButton';

const WorkingPage = () => {
  const { state } = useLocation();
  console.log("state", state);

  if (state) {
    var { filePath, inputType, outputType, deduped, removed } = state;
    inputType = inputType.join(', ');
    outputType = outputType.join(', ');
    var settings = { filePath, inputType, outputType };
    console.log("settings",settings);
    console.log("deduped, removed", deduped, removed);
  } else {
    console.log('State is undefined or null');
  }
 
  console.log("settings1", {settings})
  let progress = null
  console.log("filePath:", filePath);
  console.log("inputType:", inputType);
  console.log("outputType:", outputType);

//console.log("Files", files); // log the files array


  return (
    <MantineProvider>
      <div className="container">
        <h2>Step 2</h2>
      </div>
      <Settings settings={settings} />
      <RemovedFiles removed={removed} />
      <FilesToConvert deduped={deduped} />
      <ConvertButton deduped={deduped} />
      <div className="container"><progress value={progress} /></div>
      <div className="container"><Link to="/Home">Go to Home</Link></div>
      <div className="container"><Link to="/Finished">Go to Finished</Link></div>
    </MantineProvider>
  )
}

export default WorkingPage