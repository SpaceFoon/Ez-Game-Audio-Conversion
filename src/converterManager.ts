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
import { removeIfWrittenSince } from './fileCleanup.js';
import { registerCancelCleanup } from './cancel.js';

type WorkerManagerMessage =
  | { type: 'stderr'; data: string }
  | { type: 'error'; data: string }
  | { type: 'warning'; data: string }
  | { type: 'code'; data: number }
  | { type: string; data?: unknown; [key: string]: unknown };

type FatalFfmpegErrorKind = 'disk-space' | null;

/**
 * Only a full disk stops the whole batch: it affects every job. A permission
 * error belongs to one file (e.g. a read-only existing output), so that job
 * fails on its own and the rest of the batch carries on.
 */
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

  return null;
};

/** Kill an ffmpeg process a worker started. Terminating the worker alone leaves it running. */
const killProcess = (pid: number | undefined): void => {
  if (!pid) return;
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Already exited.
  }
};

/**
 * Remove this job's own file paths from ffmpeg's stderr before looking for
 * fatal conditions, so a folder named e.g. "Permission denied" can't abort
 * the whole batch. A real error still matches on the text around the path.
 */
export const stripJobPaths = (text: string, paths: string[]): string =>
  paths
    .filter(Boolean)
    .reduce((acc, path) => acc.split(path).join('<path>'), text);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Match createConversionList — per-file logs only for small batches. */
const QUIET_BATCH_THRESHOLD = 20;
const QUIET_PROGRESS_INTERVAL = 100;

const convertFiles = async (
  files: ConversionItem[]
): Promise<ConversionJob> => {
  initializeFileNames();
  const jobStartTime = Date.now();
  // CSV writes are async; keep them so we can wait for every row to land
  // before returning (finalize writes the SUMMARY row right after).
  const pendingLogs: Promise<unknown>[] = [];
  const log = (...args: Parameters<typeof addToLog>): void => {
    try {
      pendingLogs.push(Promise.resolve(addToLog(...args)).catch(() => {}));
    } catch {
      // addToLog reports its own failures; never let logging break a batch
    }
  };
  let cpuNumber;
  try {
    cpuNumber = cpus().length;
  } catch {
    cpuNumber = 8;
    logger.warn(
      '🚨🚨⛔ Could not detect amount of CPU cores!!! Setting to 8 ⛔🚨🚨'
    );
  }

  const queue = [...files];
  const maxConcurrentWorkers = Math.round(Math.min(cpuNumber, queue.length));
  const failedFiles: ConversionResult[] = [];
  const successfulFiles: ConversionResult[] = [];
  // Each running worker, with the ffmpeg process it started (if any) and the
  // output it is writing, so an abort can stop ffmpeg and clean up.
  const activeWorkers = new Map<
    Worker,
    { pid?: number; outputFile: string; startedAt: number; killed?: boolean }
  >();
  // Ctrl+C: stop every running ffmpeg and remove what it had half-written.
  const unregisterCancel = registerCancelCleanup(() => {
    for (const [worker, entry] of activeWorkers) {
      killProcess(entry.pid);
      void worker.terminate?.();
      removeIfWrittenSince(entry.outputFile, entry.startedAt);
    }
  });
  const failedOutputs = new Set<string>();
  let abortRequested = false;
  // Shared across workers so concurrent fatal errors prompt the user only once.
  let fatalPrompt: Promise<unknown> | null = null;
  const showDetailedLogs = files.length <= QUIET_BATCH_THRESHOLD;
  const totalFiles = files.length;
  let completedCount = 0;

  const recordCompletion = (): void => {
    completedCount++;
    if (
      !showDetailedLogs &&
      (completedCount % QUIET_PROGRESS_INTERVAL === 0 ||
        completedCount === totalFiles)
    ) {
      process.stdout.write(
        `\r   Converting: ${completedCount}/${totalFiles} completed...`
      );
    }
  };

  /** De-duplicate and record a failed conversion, preserving the reason. */
  const recordFailure = (file: ConversionItem, error?: string) => {
    if (!failedOutputs.has(file.outputFile)) {
      failedOutputs.add(file.outputFile);
      failedFiles.push({
        success: false,
        inputFile: file.inputFile,
        outputFile: file.outputFile,
        ...(error ? { error } : {}),
      });
    }
  };
  logger.info('\n   Detected 🕵️‍♂️', cpuNumber, 'CPU Cores 🖥');
  logger.log('   Using', maxConcurrentWorkers, 'concurrent 🧵 threads');
  if (!showDetailedLogs) {
    logger.log(chalk.cyanBright(`\n🔄 Converting ${totalFiles} files...`));
  }

  const processFile = async (
    file: ConversionItem,
    workerCounter: number,
    task: number,
    tasksLeft: number
  ): Promise<void> => {
    const workerStartTime = performance.now();
    const jobStartedAt = Date.now();
    if (showDetailedLogs) {
      logger.log(
        chalk.cyanBright(
          `\n🛠️👷‍♂️ Worker ${workerCounter} has started 📋 task ${task} with ${tasksLeft} tasks left. Output file:\n   ${file.outputFile}📤`
        )
      );
    }

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
        log(
          {
            type: 'error' as const,
            data: logData,
          },
          file
        );
        logger.error(
          chalk.red(`\n❌ Error: ${file.outputFile}\n   ${displayMessage}`)
        );
        recordFailure(file, logData);
        recordCompletion();
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
        activeWorkers.set(worker, {
          outputFile: file.outputFile,
          startedAt: jobStartedAt,
        });

        worker.on('message', (message: unknown) => {
          if (!isRecord(message) || typeof message.type !== 'string') return;
          const typedMessage = message as WorkerManagerMessage;

          // The worker reports its ffmpeg process so an abort can kill it.
          if (typedMessage.type === 'pid') {
            const entry = activeWorkers.get(worker);
            if (entry && typeof typedMessage.data === 'number') {
              entry.pid = typedMessage.data;
            }
            return;
          }

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

            const fatalKind = detectFatalFfmpegError(
              stripJobPaths(stderrOutput, [file.inputFile, file.outputFile])
            );
            if (fatalKind && !fatalExitRequested) {
              fatalExitRequested = true;
              abortRequested = true;
              errorLogged = true;

              // A full disk affects every job, not just this one. Stop the
              // other in-flight jobs now — their ffmpeg processes too, which
              // terminating the worker thread alone would leave running — and
              // remove what they had half-written. Queued jobs are skipped via
              // the abortRequested check in the worker loop.
              for (const [other, entry] of activeWorkers) {
                if (other === worker) continue;
                entry.killed = true;
                killProcess(entry.pid);
                void other.terminate?.();
              }

              const fatalMessage =
                'Fatal ffmpeg error: insufficient disk space.';
              log(
                {
                  type: 'error' as const,
                  data: `${fatalMessage} ${stderrOutput.trim()}`,
                },
                file
              );

              logger.error(
                '\n 🚨⛔🚨 Stopping due to insufficient disk space! 🚨💽🚨'
              );

              fatalPrompt ??= getAnswer(
                'Press ENTER to return to the main menu...'
              );
              void fatalPrompt.then(() => {
                recordFailure(file, `${fatalMessage} ${stderrOutput.trim()}`);
                recordCompletion();
                resolveOnce();
              });
              return;
            }
            return;
          }

          // Non-fatal warnings (e.g. metadata cleanup): record in the error
          // log without failing the job.
          if (typedMessage.type === 'warning') {
            log(
              { type: 'error' as const, data: String(typedMessage.data ?? '') },
              { inputFile: file.inputFile, outputFile: '[metadata-cleanup]' }
            );
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
              log({ type: 'code', data: exitCode }, file);
              successfulFiles.push({
                success: true,
                inputFile: file.inputFile,
                outputFile: file.outputFile,
              });
              if (showDetailedLogs) {
                logger.log(
                  chalk.greenBright(
                    `\n🛠️👷‍♂️ Worker`,
                    workerCounter,
                    `finished task`,
                    task,
                    `\n   Input: ${file.inputFile}\n   Output: ${
                      file.outputFile
                    } ✅\n   in ${workerCompTime.toFixed(0)} milliseconds🕖`
                  )
                );
              }
              recordCompletion();
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
          const entry = activeWorkers.get(worker);
          activeWorkers.delete(worker);
          if (entry?.killed && !settled) {
            // Stopped by a fatal abort before it finished: drop the partial file.
            removeIfWrittenSince(file.outputFile, jobStartedAt);
            recordFailureWithLog(
              'Stopped: batch aborted after fatal ffmpeg error.',
              'Stopped: batch aborted after fatal ffmpeg error.'
            );
            return;
          }
          if (settled) return;

          // A successful conversion always settles first via the worker's
          // 'code' (data: 0) message. If we reach the exit handler still
          // unsettled, the worker exited WITHOUT confirming success — a clean
          // OS exit code is not proof the file was written. Treat it as a
          // failure to avoid silently counting lost work as a success.
          recordFailureWithLog(
            `Worker exited (code ${exitCode}) without reporting success. ${stderrOutput.trim()}`,
            `Worker exited (code ${exitCode}) without confirming the conversion completed.${
              stderrOutput.trim() ? `\n   ${stderrOutput.trim()}` : ''
            }`
          );
        });
      } catch (error) {
        const message = `Error creating worker: ${String(
          error instanceof Error ? error.message : error
        )}`;
        logger.error(message);
        log(
          {
            type: 'error' as const,
            data: message,
          },
          file
        );
        recordFailure(file, message);
        recordCompletion();
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
        while (queue.length > 0) {
          if (abortRequested) break;
          const file = queue.pop();
          try {
            const tasksLeft = queue.length;
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
  unregisterCancel();

  // Files never started because a fatal error stopped the batch still need to
  // show up in the results, otherwise the summary undercounts the batch.
  if (abortRequested) {
    for (const file of queue.splice(0)) {
      const message = 'Skipped: batch aborted after fatal ffmpeg error.';
      log({ type: 'error' as const, data: message }, file);
      recordFailure(file, message);
    }
  }

  await Promise.all(pendingLogs);

  if (!showDetailedLogs && totalFiles > 0) {
    process.stdout.write(
      `\r   Converting: ${totalFiles}/${totalFiles} completed.\n`
    );
  }

  return { failedFiles, successfulFiles, jobStartTime: new Date(jobStartTime) };
};

export { convertFiles };
