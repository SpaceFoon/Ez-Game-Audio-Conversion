//WorkingPage.jsx
import { MantineProvider } from '@mantine/core';
import { Link, useLocation  } from 'react-router-dom';
import LogsComponent from '../Components/UI/LogsComponent';

const WorkingPage = () => {
  
  const { state } = useLocation();
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
        <h2>Working Screen</h2>
      </div>
          <LogsComponent settings={settings}/>
      <div className="container"><progress value={progress} /></div>
      <div className="container"><Link to="/Home">Go to Home</Link></div>
      <div className="container"><Link to="/Finished">Go to Finished</Link></div>
   </MantineProvider>
   )
}

export default WorkingPage