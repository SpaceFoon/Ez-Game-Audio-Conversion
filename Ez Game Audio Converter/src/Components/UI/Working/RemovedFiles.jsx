// RemovedFiles.jsx
// List of files that were removed from the deduped list
import PropTypes from 'prop-types';

const RemovedFiles = ({ removed }) => {
    return (
        <div>
            <h2>Removed Files</h2>
            <ul>
                {removed.map((file, index) => (
                    <li key={index}>{file}</li>
                ))}
            </ul>
        </div>
    );
};

RemovedFiles.propTypes = {
    removed: PropTypes.array.isRequired,
};

export default RemovedFiles;
