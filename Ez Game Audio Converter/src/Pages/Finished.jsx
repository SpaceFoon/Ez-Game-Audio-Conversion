// Finished.jsx

import { Link } from 'react-router-dom';
import FinishedReport from '../Components/UI/Finished/FinishedReport';
const Finished = () => {
  return (
  <>
  {/* list of finished files as they are completed */}
    <div className="container"><h2>Finished Screen</h2></div>
    <Link to="/HomePage">Go to HomePage</Link>
    <FinishedReport />
  </>
  );
};

export default Finished;
