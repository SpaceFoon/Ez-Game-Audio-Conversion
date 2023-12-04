// PendingChangesComponent.jsx
export async function HandlePendingChanges(pendingChanges, setPendingChanges){
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

      const response = await new Promise((res, rej) => {
        setQuestion(`what to do with file ${f.inputFile}?`);
        dialog.current.addEventListener('close', () => res(dialog.current.returnValue));
        dialog.current.showModal();
      });

      responseActions[response]();
      setPendingChanges([...pendingChanges, { inputFile: f.inputFile, outputFile: f.outputFile }]);
      console.log(pendingChanges);
      //pendingChanges.push({ inputFile: f.inputFile, outputFile: f.outputFile });
    }
  };
//export default HandlePendingChanges;