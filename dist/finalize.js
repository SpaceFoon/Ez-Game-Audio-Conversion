import { performance } from 'perf_hooks';
import { settings, rl, isPackagedRuntime, runtimeBaseDir } from './utils.js';
import { spawn } from 'child_process';
import chalk from 'chalk';
const finalize = async (failedFiles = [], successfulFiles = [], jobStartTime = Date.now()) => {
    const jobEndTime = performance.now();
    const startMs = typeof jobStartTime === 'number' ? jobStartTime : jobStartTime.getTime();
    let totalTime = jobEndTime - startMs;
    totalTime = totalTime / 1000;
    const count = Array.isArray(successfulFiles) ? successfulFiles.length : 0;
    const average = count > 0 ? totalTime / count : 0;
    console.log(`\n    Total job duration: ${totalTime.toFixed(2)} seconds\n    Average task duration ${average.toFixed(2)} seconds\n`);
    if (successfulFiles && successfulFiles.length > 0) {
        console.log('Successes:', successfulFiles.length, successfulFiles.map((file) => file.outputFile));
    }
    else {
        console.log('NO SUCCESSFUL CONVERSIONS.');
    }
    if (failedFiles && failedFiles.length > 0) {
        console.log('Failures:', failedFiles.length, failedFiles.map((file) => file.outputFile));
    }
    else {
        console.log('No conversions failed.');
    }
    console.log(`Log files are in: ${settings.outputFilePath}. Press Enter to restart when ready.`);
    const promptToRestart = () => {
        rl.question(chalk.blue('Press ENTER to restart the program.'), () => {
            rl.close();
            console.log('Restarting the app...');
            const exec = process.execPath;
            const args = isPackagedRuntime ? [] : process.argv.slice(1);
            const cwd = isPackagedRuntime ? runtimeBaseDir : process.cwd();
            spawn(exec, args, { stdio: 'inherit', detached: false, cwd });
            process.exit();
        });
    };
    promptToRestart();
};
export default finalize;
//# sourceMappingURL=finalize.js.map