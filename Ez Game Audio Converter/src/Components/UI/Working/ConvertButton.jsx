// ConvertButton.jsx
import PropTypes from 'prop-types';
import createConversionList from '../../Backend/createConversionList';

const ConvertButton = ({ settings, deduped }) => {
    const handleClick = () => {
        createConversionList(settings, deduped);
    };

    return (
        <button onClick={handleClick}>Convert Files</button>
    );
};

ConvertButton.propTypes = {
    deduped: PropTypes.array.isRequired,
};

export default ConvertButton;
