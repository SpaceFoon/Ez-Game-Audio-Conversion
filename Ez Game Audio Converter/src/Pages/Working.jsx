//WorkingPage.jsx

import { MantineProvider } from '@mantine/core';
import { Link } from 'react-router-dom';

   const WorkingPage = () => {
   let progress = null

   return( <MantineProvider>
      <div className="container"><h2>Working Screen</h2></div>
      <div className="container"><progress value={progress} /></div>
      <div className="container">      <Link to="/Home">Go to Home</Link>
</div>
      <div className="container">      <Link to="/Finished">Go to Finished</Link>
</div>
   </MantineProvider>
   )
}
export default WorkingPage