// handlePendingChanges.js
import { ask } from "@tauri-apps/api/dialog";

const handlePendingChanges = ({ pendingChanges, setPendingChanges }) => {
  let didpickall = "";
  const handleResponse = (response, f) => {
    const responseActions = {
      o: () => {},
      oa: () => {
        didpickall = "oa";
      },
      r: () => {
        f.outputFile = f.outputFileCopy;
      },
      ra: () => {
        f.outputFile = f.outputFileCopy;
        didpickall = "ra";
      },
      s: () => {
        f.outputFile = "skipped!";
      },
      sa: () => {
        f.outputFile = "skipped!";
        didpickall = "sa";
      },
    };

    if (didpickall) {
      responseActions[didpickall]();
      console.log(responseActions[didpickall]);
      return;
    }

    responseActions[response]();
    setPendingChanges((prevChanges) => [
      ...prevChanges,
      { inputFile: f.inputFile, outputFile: f.outputFile },
    ]);
  };

  const handleChanges = async () => {
    for (let f of pendingChanges) {
      setQuestion(`what to do with file ${f.inputFile}?`);

      const response = new Promise((res, rej) => {
        ask.current.addEventListener("close", () =>
          res(ask.current.returnValue)
        );
        ask.current.showModal();
        if (rej) return console.error("Broke at const response");
      });

      const result = await response;
      handleResponse(result, f);

      console.log(pendingChanges);
      return question;
    }
  };
  {
    /* <dialog ref={dialog}>
          <form>
            <p>{question}</p>
            <button value='o' onClick={handleDialogOption}>Overwrite</button>
            <button value='oa' onClick={handleDialogOption}>Overwrite All</button>
            <button value='r' onClick={handleDialogOption}>Rename</button>
            <button value='ra' onClick={handleDialogOption}>Rename All</button>
            <button value='s' onClick={handleDialogOption}>Skip</button>
            <button value='sa' onClick={handleDialogOption}>Skip All</button>
          </form>
        </dialog> */
  }
  // Call the handleChanges function
  handleChanges();

  // Return JSX or null based on your use case
  return null;
};

export default handlePendingChanges;
