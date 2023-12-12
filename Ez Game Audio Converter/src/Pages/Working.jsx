//WorkingPage.jsx
import { MantineProvider } from '@mantine/core';
import { Link, useLocation  } from 'react-router-dom';
import Settings from '../Components/UI/Working/Settings';
import FilesToConvert from '../Components/UI/Working/FilesToConvert';
const WorkingPage = ({files}) => {
  
  const { state } = useLocation();
  console.log("state", state);
if (state) {
  var { filePath, inputType, outputType } = state;
  inputType = inputType.join(', ');
  outputType = outputType.join(', ');
  var settings = { filePath, inputType, outputType };
  console.log("settings",settings);
} else {
  console.log('State is undefined or null');
}
 
  console.log("settings1", {settings})
  let progress = null
  console.log("filePath:", filePath);
  console.log("inputType:", inputType);
  console.log("outputType:", outputType);

   return(
   <MantineProvider>
      <div className="container">
        <h2>Working  7</h2>
      </div>
          <Settings settings={settings}/>
          <FilesToConvert files={files} />
      <div className="container"><progress value={progress} /></div>
      <div className="container"><Link to="/Home">Go to Home</Link></div>
      <div className="container"><Link to="/Finished">Go to Finished</Link></div>
   </MantineProvider>
   )
}

export default WorkingPage