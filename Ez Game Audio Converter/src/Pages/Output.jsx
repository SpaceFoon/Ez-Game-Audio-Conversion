// Output.jsx
import { Link , useLocation} from 'react-router-dom';
import { useState, useEffect } from 'react';
import createConversionList from '../Components/Backend/createConversionList';
import FinalList from '../Components/UI/Output/FinalList';
import ConvertButton from '../Components/UI/Output/ConvertButton';
export default function Output () {
       const { state } = useLocation();
       const { conversionList } = state;
//   console.log("state2", state);
//   console.log("settings2", settings, deduped, conversionList)

    return (
    <>
        {/* Final list of jobs to do */}
          <FinalList conversionList={conversionList}/>

        {/* progress bar */}
        {/*go to */}
        {/* final confirm button before conversion */}
        <ConvertButton conversionList={conversionList}/>
        <Link to="/Finished">Go to Finished</Link>
    </>
    );
    }