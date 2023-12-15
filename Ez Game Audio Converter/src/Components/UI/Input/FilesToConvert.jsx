//FilesToConvert.jsx
import PropTypes from 'prop-types';

const FilesToConvert = ({deduped}) => {
    const amountOfFiles = deduped.length;
    return (
      <div>
        <fieldset>
        <legend>
            Files to Convert: {amountOfFiles} files
        </legend>
            <ul>
            {deduped.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
            </ul>
        </fieldset>
    </div>
);
            }
FilesToConvert.propTypes = {
    deduped: PropTypes.array.isRequired,
};

export default FilesToConvert;