// InputFormatCheckboxComponent.jsx

import propTypes from 'prop-types';
const  InputFormatCheckboxComponent = ({ label, value, checked, onChange }) => (
  <label htmlFor={value}>
    <input
      id={`i${value}`}
      type="checkbox"
      name="inputType"
      value={value}
      checked={checked}
      onChange={() => onChange(value)}
    />
    {label}
  </label>
);
InputFormatCheckboxComponent.propTypes = {
  label: propTypes.string,
  value: propTypes.string,
  checked: propTypes.bool,
  onChange: propTypes.func,
}
export default InputFormatCheckboxComponent;
