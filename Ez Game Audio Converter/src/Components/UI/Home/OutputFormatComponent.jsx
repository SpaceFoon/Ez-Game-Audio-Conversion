// OutputFormatComponent.jsx
import propTypes from 'prop-types';
const OutputFormatComponent = ({ label, value, checked, onChange }) => (
  <label htmlFor={value}>
    <input
      id={`o${value}`}
      type="checkbox"
      name="outputType"
      value={value}
      checked={checked}
      onChange={() => onChange(value)}
    />
    {label}
  </label>
);
OutputFormatComponent.propTypes = {
  label: propTypes.string,
  value: propTypes.string,
  checked: propTypes.bool,
  onChange: propTypes.func,
}
export default OutputFormatComponent;
