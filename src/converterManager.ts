//Creates workers to convert files

import type {
  ConversionItem,
  ConversionJob,
  ConversionResult,
} from './types/audio.js';

import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';
import { cpus } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import chalk from 'chalk';
import {
  initializeFileNames,
  addToLog,
  settings,
  getAnswer,
  runtimeBaseDir,
  isPackagedRuntime,
} from './utils.js';

type WorkerManagerMessage =
  | { type: 'stderr'; data: string }
  | { type: 'error'; data: string }
  | { type: 'code'; data: number }
  | { type: string; data?: unknown; [key: string]: unknown };

type FatalFfmpegErrorKind = 'disk-space' | 'permission' | null;

const detectFatalFfmpegError = (stderrText: string): FatalFfmpegErrorKind => {
  const text = stderrText.toLowerCase();

  const diskSpacePatterns = [
    /\benospc\b/i,
    /no space left/i,
    /not enough space/i,
    /disk full/i,
  ];

  if (diskSpacePatterns.some((pattern) => pattern.test(text))) {
    return 'disk-space';
  }

  const permissionPatterns = [
    /\beacces\b/i,
    /\beperm\b/i,
    /permission denied/i,
    /access is denied/i,
    /operation not permitted/i,
  ];

  if (permissionPatterns.some((pattern) => pattern.test(text))) {
    return 'permission';
  }

  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// Handle both ESM and bundled CJS contexts
const __filename_esm =
  typeof import.meta?.url === 'string' && import.meta.url
    ? fileURLToPath(import.meta.url)
    : '';
const __filename_resolved =
  __filename_esm || (typeof __filename !== 'undefined' ? __filename : '');
const __dirname_resolved = __filename_resolved
  ? dirname(__filename_resolved)
  : '';

const convertFiles = async (
  files: ConversionItem[]
): Promise<ConversionJob> => {
  initializeFileNames();
  const jobStartTime = performance.now();
  let cpuNumber;
  try {
    cpuNumber = cpus().length;
  } catch {
    cpuNumber = 8;
    console.warn(
      '🚨🚨⛔ Could not detect amount of CPU cores!!! Setting to 8 ⛔🚨🚨'
    );
  }

  const maxConcurrentWorkers = Math.round(
    Math.min(cpuNumber, Array.isArray(files) ? files.length : 0)
  );
  const failedFiles: ConversionResult[] = [];
  const successfulFiles: ConversionResult[] = [];

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
  console.info('\n   Detected 🕵️‍♂️', cpuNumber, 'CPU Cores 🖥');
  console.log('   Using', maxConcurrentWorkers, 'concurrent 🧵 threads');

  const processFile = async (
    file: ConversionItem,
    workerCounter: number,
    task: number,
    tasksLeft: number
  ): Promise<void> => {
    const workerStartTime = performance.now();
    console.log(
      chalk.cyanBright(
        `\n🛠️👷‍♂️ Worker ${workerCounter} has started 📋 task ${task} with ${tasksLeft} tasks left. Output file:\n   ${file.outputFile}📤`
      )
    );

    return new Promise((resolve) => {
      try {
        // Clone the data to prevent any circular references
        const workerDataJson = JSON.stringify({
          file: {
            inputFile: file.inputFile,
            outputFile: file.outputFile,
            outputFormat: file.outputFormat,
          },
          settings: {
            oggCodec: settings.oggCodec || 'vorbis',
            loopDataMode: settings.loopDataMode || 'auto',
          },
        });

        const workerData = JSON.parse(workerDataJson);

        // Determine the correct path for the worker based on runtime environment
        // Search multiple candidate locations for the worker file
        const workerCandidates = isPackagedRuntime
          ? [
              join(runtimeBaseDir, 'dist', 'converterWorker.cjs'),
              join(runtimeBaseDir, 'converterWorker.cjs'),
              join(dirname(process.execPath), 'dist', 'converterWorker.cjs'),

              // Back-compat (older packages)
              join(runtimeBaseDir, 'dist', 'converterWorker.js'),
              join(runtimeBaseDir, 'converterWorker.js'),
              join(dirname(process.execPath), 'dist', 'converterWorker.js'),
            ]
          : [
              join(__dirname_resolved, '..', 'dist', 'converterWorker.js'),
              join(__dirname_resolved, 'converterWorker.js'),
              join(process.cwd(), 'dist', 'converterWorker.js'),

              // Fallback (bundled worker)
              join(__dirname_resolved, '..', 'dist', 'converterWorker.cjs'),
              join(__dirname_resolved, 'converterWorker.cjs'),
              join(process.cwd(), 'dist', 'converterWorker.cjs'),
            ];

        const workerPath = workerCandidates.find((p) => existsSync(p));

        if (!workerPath) {
          throw new Error(
            `Worker file not found. Searched:\n${workerCandidates.join('\n')}\nruntimeBaseDir: ${runtimeBaseDir}\n__dirname_resolved: ${__dirname_resolved}`
          );
        }

        const worker = new Worker(workerPath, {
          workerData,
        });

        let settled = false;
        const resolveOnce = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        // Accumulate stderr for final error log
        let stderrOutput = '';
        let errorLogged = false;
        let fatalExitRequested = false;

        worker.on('message', (message: unknown) => {
          if (!isRecord(message) || typeof message.type !== 'string') return;
          const typedMessage = message as WorkerManagerMessage;

          // Accumulate stderr messages (don't log each one individually)
          if (typedMessage.type === 'stderr') {
            const stderrMessage = String(typedMessage.data ?? '');
            stderrOutput += stderrMessage + ' ';
            console.error(
              'FFmpeg stderr:',
              stderrMessage,
              String(file.inputFile ?? ''),
              String(file.outputFile ?? '')
            );

            const fatalKind = detectFatalFfmpegError(stderrOutput);
            if (fatalKind && !fatalExitRequested) {
              fatalExitRequested = true;

              if (fatalKind === 'disk-space') {
                console.error(
                  '\n 🚨⛔🚨 Stopping due to insufficient disk space! 🚨💽🚨'
                );
              } else {
                console.error(
                  '\n 🚨⛔🚨 Stopping due to file permission/access error! 🚨🔐🚨'
                );
              }

              void getAnswer('Press ENTER to exit...').then(() =>
                process.exit(1)
              );
            }
            return;
          }

          // Handle error type messages - log immediately and mark as logged
          if (typedMessage.type === 'error') {
            if (!errorLogged) {
              errorLogged = true;
              const errorMessage = {
                type: 'error' as const,
                data: String(typedMessage.data ?? ''),
              };
              addToLog(errorMessage, file);
              // Show error with details
              console.error(
                chalk.red(
                  `\n❌ Error: ${file.outputFile}\n   ${String(typedMessage.data ?? '')}`
                )
              );

              recordFailure(file);
              resolveOnce();
            }
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
              console.log(
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
            } else if (exitCode !== 0 && !errorLogged) {
              errorLogged = true;
              // Log the error once with accumulated stderr
              const errorMessage = {
                type: 'error' as const,
                data: `ffmpeg exited with code ${exitCode}. ${stderrOutput.trim()}`,
              };
              addToLog(errorMessage, file);
              // Show error with details
              console.error(
                chalk.red(
                  `\n❌ Error: ${file.outputFile}\n   ffmpeg exit code ${exitCode}: ${stderrOutput.trim() || 'No error output'}`
                )
              );

              recordFailure(file);
              resolveOnce();
            }
          }
        });

        worker.on('error', (error: unknown) => {
          const message = `Worker had an error: ${String(
            error instanceof Error ? error.message : error
          )}`;
          console.error(
            message,
            String(file.inputFile ?? ''),
            String(file.outputFile ?? '')
          );
          addToLog(
            {
              type: 'error' as const,
              data: message,
            },
            file
          );
          recordFailure(file);
          resolveOnce();
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

          const exitMessage = `Worker exited with code ${exitCode}. ${stderrOutput.trim()}`;
          addToLog(
            {
              type: 'error' as const,
              data: exitMessage,
            },
            file
          );
          console.error(
            chalk.red(
              `\n ❌ Error: ${file.outputFile}\n   Worker exited with code ${exitCode}: ${stderrOutput.trim() || 'No error output'}`
            )
          );
          recordFailure(file);
          resolveOnce();
        });
      } catch (error) {
        console.error('Error creating worker:', error);
        recordFailure(file);
        resolve();
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
          const file = files.pop();
          try {
            const tasksLeft = files.length;
            task++;
            workerCounter++;
            if (workerCounter > maxConcurrentWorkers) workerCounter = 1;
            if (file) await processFile(file, workerCounter, task, tasksLeft);
          } catch (error) {
            console.error(error);
          }
        }
      })()
    );
  }

  await Promise.all(workerPromises);
  return { failedFiles, successfulFiles, jobStartTime: new Date(jobStartTime) };
};

export { convertFiles };
