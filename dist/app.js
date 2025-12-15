import cfonts from 'cfonts';
import { platform } from 'os';
import os from 'os';
import { config } from 'dotenv';
import getUserInput from './getUserInput.js';
import searchFiles from './searchFiles.js';
import createConversionList from './createConversionList.js';
import { convertFiles } from './convertFiles.js';
import { settings } from './utils.js';
import finalize from './finalize.js';
import ExitProgramError from './exitProgramError.js';
// Ensure global type augmentation is loaded for ts-node/tsc
import './types/global.js';
config();
function runApp() {
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
    cfonts.say('|||EZ Game|Audio', {
        font: 'huge',
        align: 'center',
        gradient: ['green', '#f80'],
        background: 'black',
        // colors: ["red", "blue"],
        independentGradient: true, // define if you want to recalculate the gradient for each new line
        transitionGradient: false, // define if this is a transition between colors directly
        env: 'node',
    });
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
        const modulePath = fileURLToPath(import.meta.url);
        const argPath = resolve(process.argv[1] || '');
        return modulePath === argPath;
    }
    catch {
        return false;
    }
})();
if (isMainModule) {
    runApp();
}
export default runApp;
//# sourceMappingURL=app.js.map