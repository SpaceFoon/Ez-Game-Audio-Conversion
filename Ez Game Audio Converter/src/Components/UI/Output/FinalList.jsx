import { Table, ScrollArea } from '@mantine/core';
import { useState } from 'react';
const FinalList = ({conversionList}) => {
  const [clipPaths, setClipPaths] = useState(false);

  const toggleClipPaths = () => {
    setClipPaths(!clipPaths);
  };

  return (
    <>
      <h2>Output Files:</h2>
      <button onClick={toggleClipPaths}>
        {clipPaths ? 'Show Full Paths' : 'Clip Paths'}
      </button>
      <ScrollArea.Autosize type='auto' mah={'70vh'} maw={'100vw'} mx="auto" scrollbarSize={20} offsetScrollbars >
        <Table striped style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '2px solid #ddd' }}>Input</th>
              <th style={{ border: '2px solid #ddd' }}>Output</th>
            </tr>
          </thead>
          <tbody>
            {conversionList.map((file, index) => (
               <tr key={index}>
                <td style={{ border: '2px solid #ddd', padding: '4px' }}>
                  {clipPaths ? file.inputFile.replace(/^.*[\\/]/, '') : file.inputFile}
                </td>
                <td style={{ border: '2px solid #ddd', padding: '4px' }}>
                  {clipPaths ? file.outputFile.replace(/^.*[\\/]/, '') : file.outputFile}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ScrollArea.Autosize>
    </>
  );
};

export default FinalList;