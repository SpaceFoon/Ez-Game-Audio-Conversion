// LogsComponent.jsx

import PropTypes from 'prop-types';
const LogsComponent = ({ logs, width, height }) => (
  <div className="retro-terminal-logs">
    <h2>Logs:</h2>
    <ul>
      {logs.map((log, index) => (
        <li key={index}>{log}</li>
      ))}
    </ul>
    <div>
      Width: {width}, height: {height}
    </div>
  </div>
  
);
LogsComponent.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.string).isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
};
export default LogsComponent;
