//CheckBoxes.jsx
import { useState } from 'react';
import InputFormatCheckboxComponent from "./InputFormatComponent"
import OutputFormatComponent from "./OutputFormatComponent"
import propTypes from 'prop-types';
const CheckBoxes = ({inputType, outputType, setInputType, setOutputType}) => {

 const [allInputsChecked, setAllInputsChecked] = useState(false);
const handleAllInputsChange = () => {
  if (allInputsChecked) {
    setInputType([]);
  } else {
    setInputType(['mp3', 'wav', 'flac', 'm4a', 'ogg', 'midi']);
  }
  setAllInputsChecked(!allInputsChecked);
};

  const handleInputChange = (value) => {
    console.log('file type change:', value);
    setInputType((current) =>
      current.includes(value) ? current.filter((x) => x !== value) : [...current, value]
    );
  };

  const handleOutputChange = (value) => {
    console.log('output type change:', value);
    setOutputType((current) =>
      current.includes(value) ? current.filter((x) => x !== value) : [...current, value]
    );
  };

return (  
    <>   
       <fieldset>
          <legend>Source Formats:</legend>
     <InputFormatCheckboxComponent
            label="All"
            value="all"
            checked={allInputsChecked}
            onChange={handleAllInputsChange} />
          <InputFormatCheckboxComponent
            label="MP3"
            value="mp3"
            checked={inputType.includes('mp3')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="WAV"
            value="wav"
            checked={inputType.includes('wav')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="FLAC"
            value="flac"
            checked={inputType.includes('flac')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="M4A"
            value="m4a"
            checked={inputType.includes('m4a')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="OGG"
            value="ogg"
            checked={inputType.includes('ogg')}
            onChange={handleInputChange} />
          <InputFormatCheckboxComponent
            label="MIDI"
            value="midi"
            checked={inputType.includes('midi')}
            onChange={handleInputChange} />
        </fieldset>

        <fieldset>
          <legend>
            Output Formats:
          </legend>
          <OutputFormatComponent
            label="OGG"
            value="ogg"
            checked={outputType.includes('ogg')}
            onChange={handleOutputChange} />
          <OutputFormatComponent
            label="M4A"
            value="m4a"
            checked={outputType.includes('m4a')}
            onChange={handleOutputChange} />
          <OutputFormatComponent
            label="WAV"
            value="wav"
            checked={outputType.includes('wav')}
            onChange={handleOutputChange} />
          <OutputFormatComponent
            label="FLAC"
            value="flac"
            checked={outputType.includes('flac')}
            onChange={handleOutputChange} />
          <OutputFormatComponent
            label="MP3"
            value="mp3"
            checked={outputType.includes('mp3')}
            onChange={handleOutputChange} />
        </fieldset>
        </>  
)
}
CheckBoxes.propTypes = {
  inputType: propTypes.array,
  outputType: propTypes.array,
  setInputType: propTypes.func,
  setOutputType: propTypes.func
}
export default CheckBoxes;