// ConvertButton.jsx
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import createConversionList from '../../Backend/createConversionList';
const ConvertButton = ({ settings, deduped }) => {
    const navigate = useNavigate();
const [conversionList, setConversionList] = useState([]);
    console.log("settings3", settings);
    console.log("deduped3", deduped);

    
         
const handleClick = async () => {
  const fetchList = async () => {
    const list = await createConversionList(settings, deduped);
    setConversionList(list);
    navigate("/Output", { state: { settings, deduped, conversionList: list } });
  };


  await fetchList();
}


    return (
        <button onClick={handleClick}>Next</button>
        
    );
};

ConvertButton.propTypes = {
    settings: PropTypes.object.isRequired,
    deduped: PropTypes.array.isRequired,
};

export default ConvertButton;
