// PendingChangesComponent.jsx
import { useState } from 'react'
import { ask } from '@tauri-apps/api/dialog';
const HandlePendingChanges = (pendingChanges, setPendingChanges) => {
  const [question, setQuestion] = useState('');
    let didpickall = '';

    for (let f of pendingChanges) {
      const responseActions = {
        o: () => { },
        oa: () => { didpickall = 'oa'; },
        r: () => { f.outputFile = f.outputFileCopy; },
        ra: () => { f.outputFile = f.outputFileCopy; didpickall = 'ra'; },
        s: () => { f.outputFile = 'skipped!'; },
        sa: () => { f.outputFile = 'skipped!'; didpickall = 'sa'; }
      };

      if (didpickall) {
        responseActions[didpickall]();
        console.log(responseActions[didpickall]);
        continue;
      }

      const response = new Promise((res, rej) => {
        setQuestion(`what to do with file ${f.inputFile}?`);
        ask.current.addEventListener('close', () => res(ask.current.returnValue));
        ask.current.showModal();
        if (rej) return console.error("Broke at const response")
      });

      responseActions[response]();
      setPendingChanges([...pendingChanges, { inputFile: f.inputFile, outputFile: f.outputFile }]);
      
      console.log(pendingChanges);
      return question;
      //pendingChanges.push({ inputFile: f.inputFile, outputFile: f.outputFile });
    }
  }
export default HandlePendingChanges;