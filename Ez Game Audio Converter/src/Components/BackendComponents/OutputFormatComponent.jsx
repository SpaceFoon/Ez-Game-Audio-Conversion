// OutputFormatComponent.jsx
import React from 'react';

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

export default OutputFormatComponent;
