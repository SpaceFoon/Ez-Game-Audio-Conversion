//handleStart.jsx
import { join } from "@tauri-apps/api/path";
import { ask } from "@tauri-apps/api/dialog";
import handlePendingChanges from "./handlePendingChanges";
const arrayToString = (array) => {
  return array
    ? array.reduce((acc, value) => acc + (acc.length ? ", " : "") + value, "")
    : "";
};
const handleStart = async ({
  filePath,
  inputType,
  outputType,
  logs,
  setLogs,
  pendingChanges,
  setPendingChanges,
}) => {
  const confirmed = await ask("Proceed with the conversion? Are you sure?", {
    title: "Think about it",
    type: "warning",
  });

  if (confirmed) {
    // if (!bitrate) bitrate = 192;
    const inputTypeString = arrayToString(inputType);
    const outputTypeString = arrayToString(outputType);

    const newLogs = [
      `Source Path: ${filePath}`,
      `Input Type: ${inputTypeString}`,
      `Output Type: ${outputTypeString}`,
      // `Bitrate: ${bitrate}`,
    ];

    setLogs(logs ? [...logs, ...newLogs] : newLogs);

    handlePendingChanges(pendingChanges, setPendingChanges);
    console.log(pendingChanges, "Pending Changes");

    return { pendingChanges, logs };
  }
};

export default handleStart;
