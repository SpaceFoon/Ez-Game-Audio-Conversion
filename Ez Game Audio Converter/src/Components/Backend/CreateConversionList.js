//Create final list of files to convert and ask user for each file
import {
  join,
  dirname,
  basename,
  extname,
  existsSync,
} from "@tauri-apps/api/path";
import { getAwnser } from "./convert";

export async function createConversionList(settings, files) {
  const conversionList = [];
  let response = null;
  for (const inputFile of files) {
    for (const outputFormat of settings.outputFormats) {
      let outputFile = `${join(
        dirname(inputFile),
        basename(inputFile, extname(inputFile))
      )}.${outputFormat}`;
      //console.log(`${inputFile}`)
      //console.log(`${outputFile}`)
      let outputFileCopy = `${join(
        dirname(inputFile),
        `${basename(inputFile, extname(inputFile))} copy (1)`
      )}.${outputFormat}`;

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
              if (existsSync(outputFile)) {
                response = await getAnswer(
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
  while (true) {
    console.log("Pending conversion:", conversionList);
    const accept_answer = await getAnswer(
      "This is the list of files to be converted. Accept? Type yes or no: "
    );
    if (/^no$/i.test(accept_answer)) throw new Error("Conversion cancelled");
    if (!/^yes$/i.test(accept_answer)) {
      console.warn('invalid input, please use "yes" or "no"');
      continue;
    }
    return conversionList.filter((x) => x.outputFile !== "skipped!");
  }
}
