// InputFormatCheckboxComponent.jsx
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

export default InputFormatCheckboxComponent;
