import { settings, rl, writeSummaryToLogs } from './utils.js';
import chalk from 'chalk';
import type { ConversionResult } from './types/audio.js';

const finalize = async (
  failedFiles: ConversionResult[] = [],
  successfulFiles: ConversionResult[] = [],
  jobStartTime: Date | number = Date.now()
): Promise<boolean> => {
  const jobEndTime = Date.now();
  const startMs =
    typeof jobStartTime === 'number' ? jobStartTime : jobStartTime.getTime();
  let totalTime = jobEndTime - startMs;
  totalTime = totalTime / 1000;
  const average =
    successfulFiles.length > 0 ? totalTime / successfulFiles.length : 0;

  console.log(
    `\n    Total job duration: ${totalTime.toFixed(
      2
    )} seconds\n    Average task duration ${average.toFixed(2)} seconds\n`
  );

  const successCount = successfulFiles.length;
  const failCount = failedFiles.length;
  const totalFiles = successCount + failCount;

  // Write summary to CSV files
  writeSummaryToLogs(totalFiles, successCount, failCount, totalTime);

  if (successfulFiles && successfulFiles.length > 0) {
    console.log(
      'Successes:',
      successfulFiles.length,
      successfulFiles.map((file) => file.outputFile)
    );
  } else {
    console.log('NO SUCCESSFUL CONVERSIONS.');
  }

  if (failedFiles && failedFiles.length > 0) {
    console.log(
      'Failures:',
      failedFiles.length,
      failedFiles.map((file) => file.outputFile)
    );
  } else {
    console.log('No conversions failed.');
  }

  console.log(`Log files are in: ${settings.outputFilePath}.`);

  const promptToContinue = async (): Promise<boolean> =>
    new Promise((resolve) => {
      rl.question(
        chalk.blue(
          'Press ENTER to run another conversion, or type q then ENTER to quit.'
        ),
        (answer?: string) => {
          const normalized = String(answer || '')
            .trim()
            .toLowerCase();
          if (
            normalized === 'q' ||
            normalized === 'quit' ||
            normalized === 'exit'
          ) {
            console.log('Exiting at user request.');
            rl.close();
            resolve(false);
            return;
          }

          console.log('Restarting conversion flow...');
          resolve(true);
        }
      );
    });
  return await promptToContinue();
};

export default finalize;
