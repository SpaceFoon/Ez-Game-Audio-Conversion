import React from 'react';

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

export default LogsComponent;
