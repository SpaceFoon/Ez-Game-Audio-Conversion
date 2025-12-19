//Creates workers to convert files
import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';
import { cpus } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { initializeFileNames, addToLog, settings, checkDiskSpace, getAnswer, runtimeBaseDir, isPackagedRuntime, } from './utils.js';
// Handle both ESM and bundled CJS contexts
const __filename_esm = typeof import.meta?.url === 'string' && import.meta.url
    ? fileURLToPath(import.meta.url)
    : '';
// @ts-ignore - __filename exists in CJS context
const __filename_resolved = __filename_esm || (typeof __filename !== 'undefined' ? __filename : '');
const __dirname_resolved = __filename_resolved ? dirname(__filename_resolved) : '';
const convertFiles = async (files) => {
    initializeFileNames();
    const jobStartTime = performance.now();
    let cpuNumber;
    try {
        cpuNumber = cpus().length;
    }
    catch {
        cpuNumber = 8;
        console.warn('🚨🚨⛔ Could not detect amount of CPU cores!!! Setting to 8 ⛔🚨🚨');
    }
    const maxConcurrentWorkers = Math.round(Math.min(cpuNumber, Array.isArray(files) ? files.length : 0));
    const failedFiles = [];
    const successfulFiles = [];
    console.info('\n   Detected 🕵️‍♂️', cpuNumber, 'CPU Cores 🖥');
    console.log('   Using', cpuNumber, 'concurrent 🧵 threads');
    const processFile = async (file, workerCounter, task, tasksLeft) => {
        const workerStartTime = performance.now();
        checkDiskSpace(settings.outputFilePath);
        console.log(chalk.cyanBright(`\n🛠️👷‍♂️ Worker ${workerCounter} has started 📋 task ${task} with ${tasksLeft} tasks left on output file:\n   ${file.outputFile}📤`));
        return new Promise((resolve, reject) => {
            //TODO: if debug
            // console.log("settings-------", settings);
            try {
                // Clone the data to prevent any circular references
                const workerDataJson = JSON.stringify({
                    file: {
                        inputFile: file.inputFile,
                        outputFile: file.outputFile,
                        outputFormat: file.outputFormat,
                    },
                    settings: {
                        oggCodec: settings.oggCodec || 'vorbis', // Default to vorbis
                    },
                });
                const workerData = JSON.parse(workerDataJson);
                // Determine the correct path for the worker based on runtime environment
                // Search multiple candidate locations for the worker file
                const workerCandidates = isPackagedRuntime
                    ? [
                        join(runtimeBaseDir, 'dist', 'converterWorker.js'),
                        join(runtimeBaseDir, 'converterWorker.js'),
                        join(dirname(process.execPath), 'dist', 'converterWorker.js'),
                    ]
                    : [
                        join(__dirname_resolved, '..', 'dist', 'converterWorker.js'),
                        join(__dirname_resolved, 'converterWorker.js'),
                        join(process.cwd(), 'dist', 'converterWorker.js'),
                    ];
                const workerPath = workerCandidates.find((p) => existsSync(p));
                if (!workerPath) {
                    throw new Error(`Worker file not found. Searched:\n${workerCandidates.join('\n')}\nruntimeBaseDir: ${runtimeBaseDir}\n__dirname_resolved: ${__dirname_resolved}`);
                }
                const worker = new Worker(workerPath, {
                    workerData,
                });
                // Accumulate stderr for final error log
                let stderrOutput = '';
                let errorLogged = false;
                worker.on('message', (message) => {
                    // Accumulate stderr messages (don't log each one individually)
                    if (message.type === 'stderr') {
                        stderrOutput += message.data + ' ';
                        // Catch disk space errors and stop a runaway process
                        if (/no space left/i.test(message.data)) {
                            console.error('\n 🚨⛔🚨 Stopping due to insufficient disk space! 🚨💽🚨');
                            getAnswer('Press ENTER to exit...').then(() => process.exit(1));
                        }
                        return;
                    }
                    // Handle error type messages - log immediately and mark as logged
                    if (message.type === 'error') {
                        if (!errorLogged) {
                            errorLogged = true;
                            const errorMessage = {
                                type: 'error',
                                data: message.data,
                            };
                            addToLog(errorMessage, file);
                            // Show error with details
                            console.error(chalk.red(`\n❌ Error: ${file.outputFile}\n   ${message.data}`));
                            if (!failedFiles.some((f) => f.outputFile === file.outputFile)) {
                                failedFiles.push({
                                    success: false,
                                    inputFile: file.inputFile,
                                    outputFile: file.outputFile,
                                });
                            }
                            resolve();
                        }
                        return;
                    }
                    // File completion code (success or failure)
                    if (message.type === 'code') {
                        const workerEndTime = performance.now();
                        const workerCompTime = workerEndTime - workerStartTime;
                        if (message.data === 0) {
                            // Success
                            addToLog(message, file);
                            successfulFiles.push({
                                success: true,
                                inputFile: file.inputFile,
                                outputFile: file.outputFile,
                            });
                            console.log(chalk.greenBright(`\n🛠️👷‍♂️ Worker`, workerCounter, `finished task`, task, `\n   Input"${file.inputFile}\n   Output"${file.outputFile}✅\n   in ${workerCompTime.toFixed(0)} milliseconds🕖`));
                            resolve();
                            // File Failure code - only log if not already logged via error message
                        }
                        else if (message.data !== 0 && !errorLogged) {
                            errorLogged = true;
                            // Log the error once with accumulated stderr
                            const errorMessage = {
                                type: 'error',
                                data: `ffmpeg exited with code ${message.data}. ${stderrOutput.trim()}`,
                            };
                            addToLog(errorMessage, file);
                            // Show error with details
                            console.error(chalk.red(`\n❌ Error: ${file.outputFile}\n   ffmpeg exit code ${message.data}: ${stderrOutput.trim() || 'No error output'}`));
                            if (!failedFiles.some((f) => f.outputFile === file.outputFile)) {
                                failedFiles.push({
                                    success: false,
                                    inputFile: file.inputFile,
                                    outputFile: file.outputFile,
                                });
                            }
                            resolve();
                        }
                    }
                });
                worker.on('error', (error) => {
                    if (!failedFiles.some((f) => f.outputFile === file.outputFile)) {
                        failedFiles.push({
                            success: false,
                            inputFile: file.inputFile,
                            outputFile: file.outputFile,
                        });
                    }
                    reject(error);
                });
                worker.on('exit', () => {
                    // Exit handled by message handlers
                });
            }
            catch (error) {
                console.error('Error creating worker:', error);
                reject(error);
            }
        });
    };
    // Worker Manager
    const workerPromises = [];
    let workerCounter = 0;
    let task = 0;
    for (let i = 0; i < maxConcurrentWorkers; i++) {
        workerPromises.push((async () => {
            while (files.length > 0) {
                const file = files.pop();
                try {
                    const tasksLeft = files.length;
                    task++;
                    workerCounter++;
                    if (workerCounter > maxConcurrentWorkers)
                        workerCounter = 1;
                    if (file)
                        await processFile(file, workerCounter, task, tasksLeft);
                }
                catch (error) {
                    console.error(error);
                }
            }
        })());
    }
    await Promise.all(workerPromises);
    return { failedFiles, successfulFiles, jobStartTime: new Date(jobStartTime) };
};
export { convertFiles };
//# sourceMappingURL=converterManager.js.map