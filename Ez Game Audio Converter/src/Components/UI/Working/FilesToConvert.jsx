//FilesToConvert.jsx
import searchFiles from "../../Backend/searchFiles";
import PropTypes from 'prop-types';

const FilesToConvert = ({deduped}) => {
         if (!deduped) {
                return <div>Loading...</div>;
        }
        const list = deduped;
        return(
    <div className="container">
        <h3>Source files:</h3>
        <ul>
            {list.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    </div>
);}

FilesToConvert.propTypes = {
    deduped: PropTypes.array.isRequired,
};

export default FilesToConvert;