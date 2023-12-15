//Create final list of files to convert and ask user for each file
import { join, dirname, basename, extname } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/api/fs";
import { ConfirmDialog } from "../UI/Input/ConfirmDialog";

export default async function createConversionList(settings, files) {
  console.log("createConversionList", settings, files);
  const outputFormats = settings.outputType.split(", ");
  console.log("outputFormats", outputFormats);
  const conversionList = [];
  let response = null;

  for (const inputFile of files) {
    for (const outputFormat of outputFormats) {
      console.log("inputFile", inputFile);
      let outputFile = `${await join(
        await dirname(inputFile),
        await basename(inputFile, await extname(inputFile))
      )}${outputFormat}`;
      console.log("inputFile", `${inputFile}`);
      console.log("outputFile", `${outputFile}`);
      let outputFileCopy = `${await join(
        await dirname(inputFile),
        `${await basename(inputFile, await extname(inputFile))} copy (1)`
      )}${outputFormat}`;

      const responseActions = {
        o: () => {
          return (response = null);
        },
        oa: () => {
          /* Nothing to do as default is overwrite */
        },
        r: () => {
          outputFile = outputFileCopy;
          return (response = null);
        },
        ra: () => {
          outputFile = outputFileCopy;
        },
        s: () => {
          outputFile = "skipped!";
          return (response = null);
        },
        sa: () => {
          outputFile = "skipped!";
        },
      };
      switch (response) {
        case null:
          console.warn("response is null in creatConverstionList");
          break;
        case "":
          break;
        case "ra":
          responseActions["ra"]();
          break;
        case "sa":
          responseActions["sa"]();
          break;
        case "oa":
          console.log("OVERWRITE FILE", outputFile);
          break;
        default:
          while (true) {
            if (!response) {
              if (await exists(outputFile)) {
                response = await ConfirmDialog(
                  `[O]verwrite, [R]ename or [S]kip. Add 'a' for all (e.g., oa, ra, sa)'\n'${outputFile}? : `
                );
                response = response.trim().toLowerCase();
                if (responseActions[response]) {
                  responseActions[response]();
                  break;
                } else {
                  response = null;
                  console.log(
                    "You did not enter a valid selection, try again."
                  );
                }
              } else break;
            }
          }
      }
      conversionList.push({
        inputFile,
        outputFile,
        outputFormat,
      });
    }
  }
  // while (true) {
  console.log("createConverstionList Pending conversion:", conversionList);

  // const accept_answer = await ConfirmDialog(
  //   "This is the list of files to be converted. Accept? Type yes or no: "
  // );
  // if (/^no$/i.test(accept_answer)) throw new Error("Conversion cancelled");
  // if (!/^yes$/i.test(accept_answer)) {
  //   console.warn('invalid input, please use "yes" or "no"');
  //   continue;
  // }
  return conversionList; //.filter((x) => x.outputFile !== "skipped!");
  // }
}
