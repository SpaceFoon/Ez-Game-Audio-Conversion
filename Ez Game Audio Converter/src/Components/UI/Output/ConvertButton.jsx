// ConvertButton.jsx
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import convertAudio from '../../Backend/convert';
const ConvertButton = (settings, conversionList) => {
    const navigate = useNavigate();
    const handleClick = async () => {
        await convertAudio(settings, conversionList);
        navigate("/Finished", { state: { failedFiles, Finished } });
    };

    return (
        <div>
            <button onClick={handleClick}>Convert</button>
        </div>
    );
};

export default ConvertButton;
