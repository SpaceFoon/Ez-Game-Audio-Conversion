import chalk from 'chalk';
import os from 'os';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import getUserInput from './getUserInput.js';
import searchFiles from './searchFiles.js';
import createConversionList from './createConversionList.js';
import { convertFiles } from './converterManager.js';
import { settings, isSeaRuntime } from './utils.js';
import finalize from './finalize.js';
import ExitProgramError from './exitProgramError.js';
// Ensure global type augmentation is loaded for ts-node/tsc
import './types/global.js';

config();

const initializeGlobalEnv = (): void => {
  if (typeof globalThis.env === 'undefined') {
    const platform = os.platform();

    globalThis.env = {
      isDev: process.env['NODE_ENV'] === 'dev',
      isDebug: process.env['DEBUG'] === 'true',
      isPkg: process.env['PKG_ENV'] === 'packaging',

      // OS info
      isWindows: platform === 'win32',
      isMac: platform === 'darwin',
      isLinux: platform === 'linux',
      arch: os.arch(), // e.g. 'x64'
      platform, // e.g. 'win32'
      cpuCount: os.cpus().length,
    };
  }
};

const logRuntimeMode = (): void => {
  if (globalThis.env.isDebug) {
    console.log('debug mode');
    console.log('stdin is TTY:', process.stdin.isTTY);
    console.log('stdout is TTY:', process.stdout.isTTY);
  }
  if (globalThis.env.isDev) {
    console.log('in dev mode');
  }
};

const setTerminalTitle = (): void => {
  process.stdout.write('\x1b]0;EZ Game Audio\x1b\x5c');
  process.stdout.write('\x1b]2;EZ Game Audio\x1b\x5c');
};

const renderBanner = async (): Promise<void> => {
  // cfonts uses dynamic require for fonts which fails in SEA bundles
  if (isSeaRuntime) {
    // Fallback banner for SEA runtime where cfonts fonts aren't available
    console.log(chalk.green.bold('\n  ╔═══════════════════════════════╗'));
    console.log(
      chalk.green.bold('  ║') +
        chalk.yellow.bold('     EZ Game Audio Converter    ') +
        chalk.green.bold('║')
    );
    console.log(chalk.green.bold('  ╚═══════════════════════════════╝\n'));
    return;
  }

  try {
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
  } catch {
    // Graceful fallback if cfonts import fails in unusual runtimes
    console.log(chalk.green.bold('\nEZ Game Audio Converter\n'));
  }
};

const runConversionPipeline = async (): Promise<boolean> => {
  const userSettings = await getUserInput(settings);
  const files = await searchFiles(userSettings);
  const conversionItems = await createConversionList(files);
  const { failedFiles, successfulFiles, jobStartTime } =
    await convertFiles(conversionItems);
  return await finalize(failedFiles, successfulFiles, jobStartTime);
};

async function runApp(): Promise<void> {
  initializeGlobalEnv();

  // Worker is loaded dynamically by converterManager when needed
  logRuntimeMode();
  setTerminalTitle();

  await renderBanner();

  while (true) {
    try {
      const shouldContinue = await runConversionPipeline();
      if (!shouldContinue) {
        return;
      }
    } catch (error: unknown) {
      if (error instanceof ExitProgramError) {
        continue;
      }
      console.error('Fatal Error', error);
      return;
    }
  }
}

// ESM entry point check - normalize paths for cross-platform compatibility
const isMainModule = (() => {
  try {
    const entryArg = process.argv[1];
    if (!entryArg) return false;

    // In CJS bundles, import.meta.url can be empty/invalid; fall back to direct-run behavior.
    if (!import.meta?.url) return true;

    const modulePath = resolve(fileURLToPath(import.meta.url));
    const argPath = resolve(entryArg);
    return modulePath === argPath;
  } catch {
    // If fileURLToPath fails, we're likely in bundled/CJS context.
    return true;
  }
})();

if (isMainModule) {
  void runApp().catch((error: unknown) => {
    console.error('Fatal startup error', error);
  });
}

export default runApp;
