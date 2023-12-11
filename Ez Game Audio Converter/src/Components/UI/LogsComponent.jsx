//LogsComponent.jsx
const LogsComponent = ({ settings }) => {
    return (
    <div className="retro-terminal-logs">
      <h2>User Settings:</h2>
      <ul>
        {settings.map((setting, index) => (
          <li key={index}>{settings}</li>
        ))}
      </ul>
      <div>{/* Width: {width}, height: {height} */}</div>
    </div>
  );
};

export default LogsComponent;
