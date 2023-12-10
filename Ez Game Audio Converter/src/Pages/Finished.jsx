// Finished.jsx

import { MantineProvider } from '@mantine/core';
import { Link } from 'react-router-dom';

const Finished = () => {
  return (
  <MantineProvider>
    <div className="container"><h2>Finished Screen</h2></div>
    <Link to="/Home">Go to Home</Link>
  </MantineProvider>
  );
};

export default Finished;
