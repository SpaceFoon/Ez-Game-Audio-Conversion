import chalk from 'chalk';
import { platform } from 'os';
import os from 'os';
import { config } from 'dotenv';
import getUserInput from './getUserInput.js';
import searchFiles from './searchFiles.js';
import createConversionList from './createConversionList.js';
import { convertFiles } from './convertFiles.js';
import { settings, isSeaRuntime } from './utils.js';
import finalize from './finalize.js';
import ExitProgramError from './exitProgramError.js';
// Ensure global type augmentation is loaded for ts-node/tsc
import './types/global.js';
config();
async function runApp() {
    if (typeof globalThis.env === 'undefined') {
        globalThis.env = {
            isDev: process.env['NODE_ENV'] === 'dev',
            isDebug: process.env['DEBUG'] === 'true',
            isPkg: process.env['PKG_ENV'] === 'packaging',
            // OS info
            isWindows: os.platform() === 'win32',
            isMac: os.platform() === 'darwin',
            isLinux: os.platform() === 'linux',
            arch: os.arch(), // e.g. 'x64'
            platform: os.platform(), // e.g. 'win32'
            cpuCount: os.cpus().length,
        };
    }
    // Worker is loaded dynamically by converterManager when needed
    if (globalThis.env.isDebug) {
        console.log('debug mode');
        console.log('stdin is TTY:', process.stdin.isTTY);
        console.log('stdout is TTY:', process.stdout.isTTY);
    }
    if (globalThis.env.isDev) {
        console.log('in dev mode');
    }
    process.stdout.write('\x1b]0;EZ Game Audio\x1b\x5c');
    process.stdout.write('\x1b]2;EZ Game Audio\x1b\x5c');
    // cfonts uses dynamic require for fonts which fails in SEA bundles
    if (isSeaRuntime) {
        // Fallback banner for SEA runtime where cfonts fonts aren't available
        console.log(chalk.green.bold('\n  ╔═══════════════════════════════╗'));
        console.log(chalk.green.bold('  ║') + chalk.yellow.bold('     EZ Game Audio Converter    ') + chalk.green.bold('║'));
        console.log(chalk.green.bold('  ╚═══════════════════════════════╝\n'));
    }
    else {
        // Dynamic import to avoid loading cfonts in SEA (it errors even at import time)
        const cfonts = await import('cfonts');
        cfonts.default.say('|||EZ Game|Audio', {
            font: 'huge',
            align: 'center',
            gradient: ['green', '#f80'],
            background: 'black',
            independentGradient: true,
            transitionGradient: false,
            env: 'node',
        });
    }
    const userOS = platform() === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    settings.userOS = userOS;
    return (getUserInput(settings)
        // find all files of specified type in provided folder and all subfolders
        .then((settings) => searchFiles(settings))
        //delete files from the list that have the same name but different file extensions.
        //save the file that has the best format. Flac > wav > m4a > mp3
        // .then((files) => deleteDuplicateFiles(files))
        //go through list of input files and make output list.
        //there can be multiple outputs and user input is needed here for conflicting output files
        // that already exist.
        .then((files) => {
        return createConversionList(files);
    })
        // Manages workers threads in a pool.
        .then((files) => {
        return convertFiles(files);
    })
        // Print the final results of all conversions.
        .then(({ failedFiles, successfulFiles, jobStartTime }) => {
        finalize(failedFiles, successfulFiles, jobStartTime);
    })
        .catch((error) => {
        if (error instanceof ExitProgramError) {
            // Silent exit, do nothing
            return;
        }
        console.error('Fatal Error', error);
    }));
}
// ESM entry point check - normalize paths for cross-platform compatibility
import { fileURLToPath } from 'url';
import { resolve } from 'path';
const isMainModule = (() => {
    try {
        // In CJS bundles, import.meta.url may be empty string
        // In that case, we're likely the main bundled entry point
        if (!import.meta?.url) {
            // CJS context - check if require.main === module (not available in ESM)
            // For bundled code, we're always the main module
            return true;
        }
        const modulePath = fileURLToPath(import.meta.url);
        const argPath = resolve(process.argv[1] || '');
        return modulePath === argPath;
    }
    catch {
        // If fileURLToPath fails, we're likely in CJS context
        return true;
    }
})();
if (isMainModule) {
    runApp();
}
export default runApp;
//# sourceMappingURL=app.js.map