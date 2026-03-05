//Creates workers to convert files

import type {
  ConversionItem,
  ConversionJob,
  ConversionResult,
} from './types/audio.js';

import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';
import { cpus } from 'os';
import chalk from 'chalk';
import logger from './logger.js';
import {
  initializeFileNames,
  addToLog,
  settings,
  getAnswer,
  isPackagedRuntime,
  findBinary,
} from './utils.js';

type WorkerManagerMessage =
  | { type: 'stderr'; data: string }
  | { type: 'error'; data: string }
  | { type: 'code'; data: number }
  | { type: string; data?: unknown; [key: string]: unknown };

type FatalFfmpegErrorKind = 'disk-space' | 'permission' | null;

const detectFatalFfmpegError = (stderrText: string): FatalFfmpegErrorKind => {
  const diskSpacePatterns = [
    /\benospc\b/i,
    /no space left/i,
    /not enough space/i,
    /disk full/i,
  ];

  if (diskSpacePatterns.some((pattern) => pattern.test(stderrText))) {
    return 'disk-space';
  }

  const permissionPatterns = [
    /\beacces\b/i,
    /\beperm\b/i,
    /permission denied/i,
    /access is denied/i,
    /operation not permitted/i,
  ];

  if (permissionPatterns.some((pattern) => pattern.test(stderrText))) {
    return 'permission';
  }

  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const convertFiles = async (
  files: ConversionItem[]
): Promise<ConversionJob> => {
  initializeFileNames();
  const jobStartTime = Date.now();
  let cpuNumber;
  try {
    cpuNumber = cpus().length;
  } catch {
    cpuNumber = 8;
    logger.warn(
      '🚨🚨⛔ Could not detect amount of CPU cores!!! Setting to 8 ⛔🚨🚨'
    );
  }

  const maxConcurrentWorkers = Math.round(Math.min(cpuNumber, files.length));
  const failedFiles: ConversionResult[] = [];
  const successfulFiles: ConversionResult[] = [];
  let abortRequested = false;

  /** De-duplicate and record a failed conversion */
  const recordFailure = (file: ConversionItem) => {
    if (!failedFiles.some((f) => f.outputFile === file.outputFile)) {
      failedFiles.push({
        success: false,
        inputFile: file.inputFile,
        outputFile: file.outputFile,
      });
    }
  };
  logger.info('\n   Detected 🕵️‍♂️', cpuNumber, 'CPU Cores 🖥');
  logger.log('   Using', maxConcurrentWorkers, 'concurrent 🧵 threads');

  const processFile = async (
    file: ConversionItem,
    workerCounter: number,
    task: number,
    tasksLeft: number
  ): Promise<void> => {
    const workerStartTime = performance.now();
    logger.log(
      chalk.cyanBright(
        `\n🛠️👷‍♂️ Worker ${workerCounter} has started 📋 task ${task} with ${tasksLeft} tasks left. Output file:\n   ${file.outputFile}📤`
      )
    );

    return new Promise((resolve) => {
      let settled = false;
      let errorLogged = false;
      let fatalExitRequested = false;
      let stderrOutput = '';

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const recordFailureWithLog = (
        logData: string,
        displayMessage: string
      ) => {
        if (errorLogged) return;
        errorLogged = true;
        addToLog(
          {
            type: 'error' as const,
            data: logData,
          },
          file
        );
        logger.error(
          chalk.red(`\n❌ Error: ${file.outputFile}\n   ${displayMessage}`)
        );
        recordFailure(file);
        resolveOnce();
      };

      try {
        const workerData = {
          file: {
            inputFile: file.inputFile,
            outputFile: file.outputFile,
            outputFormat: file.outputFormat,
          },
          settings: {
            oggCodec: settings.oggCodec || 'vorbis',
            loopDataMode: settings.loopDataMode || 'auto',
          },
        };

        // Locate the worker file
        const workerExt = isPackagedRuntime ? 'cjs' : 'js';
        const workerPath = findBinary(`converterWorker.${workerExt}`, ['dist']);

        if (!workerPath) {
          throw new Error(
            `Worker file converterWorker.${workerExt} not found in dist/`
          );
        }

        const worker = new Worker(workerPath, {
          workerData,
        });

        worker.on('message', (message: unknown) => {
          if (!isRecord(message) || typeof message.type !== 'string') return;
          const typedMessage = message as WorkerManagerMessage;

          // Accumulate stderr messages (don't log each one individually)
          if (typedMessage.type === 'stderr') {
            const stderrMessage = String(typedMessage.data ?? '');
            stderrOutput += stderrMessage + ' ';
            logger.error(
              'FFmpeg stderr:',
              stderrMessage,
              file.inputFile,
              file.outputFile
            );

            const fatalKind = detectFatalFfmpegError(stderrOutput);
            if (fatalKind && !fatalExitRequested) {
              fatalExitRequested = true;
              abortRequested = true;
              errorLogged = true;

              const fatalMessage =
                fatalKind === 'disk-space'
                  ? 'Fatal ffmpeg error: insufficient disk space.'
                  : 'Fatal ffmpeg error: permission/access denied.';
              addToLog(
                {
                  type: 'error' as const,
                  data: `${fatalMessage} ${stderrOutput.trim()}`,
                },
                file
              );

              if (fatalKind === 'disk-space') {
                logger.error(
                  '\n 🚨⛔🚨 Stopping due to insufficient disk space! 🚨💽🚨'
                );
              } else {
                logger.error(
                  '\n 🚨⛔🚨 Stopping due to file permission/access error! 🚨🔐🚨'
                );
              }

              void getAnswer('Press ENTER to return to the main menu...').then(
                () => {
                  recordFailure(file);
                  resolveOnce();
                }
              );
              return;
            }
            return;
          }

          // Handle error type messages - log immediately and mark as logged
          if (typedMessage.type === 'error') {
            const workerErrorMessage = String(typedMessage.data ?? '');
            recordFailureWithLog(workerErrorMessage, workerErrorMessage);
            return;
          }

          // File completion code (success or failure)
          if (typedMessage.type === 'code') {
            const workerEndTime = performance.now();
            const workerCompTime = workerEndTime - workerStartTime;

            const exitCode =
              typeof typedMessage.data === 'number'
                ? typedMessage.data
                : Number(typedMessage.data);

            if (exitCode === 0) {
              // Success
              addToLog({ type: 'code', data: exitCode }, file);
              successfulFiles.push({
                success: true,
                inputFile: file.inputFile,
                outputFile: file.outputFile,
              });
              logger.log(
                chalk.greenBright(
                  `\n🛠️👷‍♂️ Worker`,
                  workerCounter,
                  `finished task`,
                  task,
                  `\n   Input"${file.inputFile}\n   Output"${
                    file.outputFile
                  }✅\n   in ${workerCompTime.toFixed(0)} milliseconds🕖`
                )
              );
              resolveOnce();
              // File Failure code - only log if not already logged via error message
            } else if (exitCode !== 0) {
              recordFailureWithLog(
                `ffmpeg exited with code ${exitCode}. ${stderrOutput.trim()}`,
                `ffmpeg exit code ${exitCode}: ${stderrOutput.trim() || 'No error output'}`
              );
            }
          }
        });

        worker.on('error', (error: unknown) => {
          const message = `Worker had an error: ${String(
            error instanceof Error ? error.message : error
          )}`;
          recordFailureWithLog(
            message,
            `${message}\n   Input: ${file.inputFile}\n   Output: ${file.outputFile}`
          );
        });

        worker.on('exit', (exitCode: number) => {
          if (settled) return;
          if (exitCode === 0) {
            if (
              !successfulFiles.some((s) => s.outputFile === file.outputFile) &&
              !failedFiles.some((f) => f.outputFile === file.outputFile)
            ) {
              successfulFiles.push({
                success: true,
                inputFile: file.inputFile,
                outputFile: file.outputFile,
              });
            }
            resolveOnce();
            return;
          }

          recordFailureWithLog(
            `Worker exited with code ${exitCode}. ${stderrOutput.trim()}`,
            `Worker exited with code ${exitCode}: ${stderrOutput.trim() || 'No error output'}`
          );
        });
      } catch (error) {
        const message = `Error creating worker: ${String(
          error instanceof Error ? error.message : error
        )}`;
        logger.error(message);
        addToLog(
          {
            type: 'error' as const,
            data: message,
          },
          file
        );
        recordFailure(file);
        resolveOnce();
      }
    });
  };

  // Worker Manager
  const workerPromises = [];
  let workerCounter = 0;
  let task = 0;
  for (let i = 0; i < maxConcurrentWorkers; i++) {
    workerPromises.push(
      (async () => {
        while (files.length > 0) {
          if (abortRequested) break;
          const file = files.pop();
          try {
            const tasksLeft = files.length;
            task++;
            workerCounter++;
            if (workerCounter > maxConcurrentWorkers) workerCounter = 1;
            if (file) await processFile(file, workerCounter, task, tasksLeft);
          } catch (error) {
            logger.error(error);
          }
        }
      })()
    );
  }

  await Promise.all(workerPromises);
  return { failedFiles, successfulFiles, jobStartTime: new Date(jobStartTime) };
};

export { convertFiles };
