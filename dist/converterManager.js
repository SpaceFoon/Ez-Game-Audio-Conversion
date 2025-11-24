//Creates workers to convert files
import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';
import { cpus } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { initializeFileNames, addToLog, settings, checkDiskSpace, rl, } from './utils.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
                // When running from source (ts-node or node dist), worker is in dist/
                // When running the packaged binary (pkg), __dirname points to a virtual fs, and the worker
                // is placed next to the main file via pkg.assets.
                const runningPkg = process.pkg;
                const workerPath = runningPkg
                    ? join(__dirname, 'converterWorker.js')
                    : join(__dirname, '..', 'dist', 'converterWorker.js');
                const worker = new Worker(workerPath, {
                    workerData,
                });
                worker.on('message', (message) => {
                    // Errors messages
                    if (message.type === 'error' || message.type === 'stderr') {
                        console.error('ERROR MESSAGE FROM FFMPEG:', message.data, 'Output file:', file.outputFile);
                        // Catch disk space errors and stop a runaway process
                        if (/no space left/i.test(message.data)) {
                            console.error('\n 🚨⛔🚨 Stopping due to insufficient disk space! 🚨💽🚨');
                            rl.question('Press ENTER to exit...', () => process.exit(1));
                        }
                        addToLog(message, file);
                        reject(new Error(message.data));
                        return;
                    }
                    // File Success code
                    if (message.type === 'code') {
                        const workerEndTime = performance.now();
                        const workerCompTime = workerEndTime - workerStartTime;
                        addToLog(message, file);
                        if (message.data === 0) {
                            successfulFiles.push({
                                success: true,
                                inputFile: file.inputFile,
                                outputFile: file.outputFile,
                            });
                            console.log(chalk.greenBright(`\n🛠️👷‍♂️ Worker`, workerCounter, `finished task`, task, `\n   Input"${file.inputFile}\n   Output"${file.outputFile}✅\n   in ${workerCompTime.toFixed(0)} milliseconds🕖`));
                            resolve();
                            // File Failure code
                        }
                        else if (message.data !== 0) {
                            if (!failedFiles.some((f) => f.outputFile === file.outputFile)) {
                                failedFiles.push({
                                    success: false,
                                    inputFile: file.inputFile,
                                    outputFile: file.outputFile,
                                });
                            }
                            console.error(chalk.bgRed('\n🚨🚨⛔ Worker', workerCounter, 'did not finish file successfully ⛔🚨🚨: ', file.outputFile));
                            resolve();
                        }
                    }
                });
                worker.on('error', (error) => {
                    console.error(`🚨🚨⛔ Worker had an error:`, error.toString(), '⛔🚨🚨');
                    if (!failedFiles.some((f) => f.outputFile === file.outputFile)) {
                        failedFiles.push({
                            success: false,
                            inputFile: file.inputFile,
                            outputFile: file.outputFile,
                        });
                    }
                    reject(error);
                });
                worker.on('exit', (code) => {
                    if (code !== 0) {
                        console.error(`Worker stopped with exit code ${code}`);
                    }
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
                    if (workerCounter > 8)
                        workerCounter = workerCounter - 8;
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