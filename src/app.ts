import chalk from 'chalk';
import os from 'os';
import { resolve } from 'path';
import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import getUserInput from './getUserInput.js';
import searchFiles from './searchFiles.js';
import createConversionList from './createConversionList.js';
import { convertFiles } from './converterManager.js';
import {
  settings,
  isSeaRuntime,
  rl,
  findBinary,
  platformSlug,
} from './utils.js';
import finalize from './finalize.js';
import ExitProgramError, {
  InputClosedError,
  UserQuitError,
} from './exitProgramError.js';
import { runCancelCleanups } from './cancel.js';
import logger from './logger.js';
import { renderSeaBanner } from './banner.js';
// Ensure global type augmentation is loaded for ts-node/tsc
import './types/global.js';

// Skip dotenv in SEA — there is no .env file and v17 prints noisy banners.
if (!isSeaRuntime) {
  config({ quiet: true });
}

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
    logger.debug('debug mode');
    logger.debug('stdin is TTY:', process.stdin.isTTY);
    logger.debug('stdout is TTY:', process.stdout.isTTY);
  }
  if (globalThis.env.isDev) {
    logger.info('in dev mode');
  }
};

const setTerminalTitle = (): void => {
  process.stdout.write('\x1b]0;EZ Game Audio\x1b\x5c');
  process.stdout.write('\x1b]2;EZ Game Audio\x1b\x5c');
};

const resizeTerminal = (): void => {
  // Only resize when launched as a standalone exe — dev terminal is already sized.
  if (!isSeaRuntime) return;
  // xterm-compatible resize escape: rows=40, cols=120
  process.stdout.write('\x1b[8;40;120t');
};

const renderBanner = async (): Promise<void> => {
  if (isSeaRuntime) {
    // cfonts uses dynamic require for font JSON files which can't resolve
    // inside a SEA bundle. Use pre-rendered banner art with chalk gradient.
    logger.log(renderSeaBanner());
    return;
  }

  try {
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
    logger.log(chalk.green.bold('\nEZ Game Audio Converter\n'));
  }
};

const runConversionPipeline = async (useCliArg: boolean): Promise<boolean> => {
  const userSettings = await getUserInput(settings, { useCliArg });
  const files = await searchFiles(userSettings);
  const conversionItems = await createConversionList(files);
  const { failedFiles, successfulFiles, jobStartTime } =
    await convertFiles(conversionItems);
  return await finalize(failedFiles, successfulFiles, jobStartTime);
};

/**
 * Ctrl+C (or a termination signal): stop any running ffmpeg, remove the
 * outputs it was half-way through writing, and exit with the conventional
 * "interrupted" status.
 */
let cancelling = false;
const onCancel = (signal: NodeJS.Signals): void => {
  if (cancelling) return;
  cancelling = true;
  logger.log('\n🛑 Cancelled — stopping conversions and cleaning up...');
  runCancelCleanups();
  try {
    rl.close();
  } catch {
    // already closed
  }
  process.exit(signal === 'SIGTERM' ? 143 : 130);
};

async function runApp(): Promise<void> {
  initializeGlobalEnv();
  process.on('SIGINT', onCancel);
  process.on('SIGTERM', onCancel);

  // Worker is loaded dynamically by converterManager when needed
  logRuntimeMode();
  setTerminalTitle();
  resizeTerminal();

  await renderBanner();

  // Check for ffmpeg before asking anything: otherwise the user answers every
  // prompt and then each file fails with "ffprobe failed".
  const missing = ['ffmpeg', 'ffprobe'].filter(
    (tool) =>
      !findBinary(platformSlug === 'windows' ? `${tool}.exe` : tool, [
        `ffmpeg-bin/${platformSlug}`,
      ])
  );
  if (missing.length > 0) {
    logger.error(
      chalk.redBright(
        `\n❌ ${missing.join(' and ')} not found. Place ${missing.length > 1 ? 'them' : 'it'} in ffmpeg-bin/${platformSlug}/ next to the app (see ffmpeg-bin/README.md).`
      )
    );
    rl.close();
    process.exitCode = 1;
    return;
  }

  let isFirstRun = true;
  while (true) {
    try {
      // A command-line path only seeds the first run; afterwards (another
      // conversion, or a cancelled one) the user picks a new input path.
      const useCliArg = isFirstRun;
      isFirstRun = false;
      const shouldContinue = await runConversionPipeline(useCliArg);
      if (!shouldContinue) {
        return;
      }
    } catch (error: unknown) {
      if (error instanceof ExitProgramError) {
        continue;
      }
      if (error instanceof UserQuitError) {
        logger.log('Exiting at user request.');
        rl.close();
        return;
      }
      if (error instanceof InputClosedError) {
        // Piped answers ran out (or Ctrl+D) before every question was answered.
        logger.error(
          '\nInput ended before all questions were answered — exiting.'
        );
        rl.close();
        process.exitCode = 1;
        return;
      }
      logger.error('Fatal Error', error);
      // Release stdin so the process can exit, and report the failure.
      rl.close();
      process.exitCode = 1;
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

    // Compare real paths: import.meta.url is already symlink-free, argv[1]
    // is not, so running through a symlinked folder would otherwise never start.
    const real = (p: string) => {
      try {
        return realpathSync(p);
      } catch {
        return resolve(p);
      }
    };
    const modulePath = real(fileURLToPath(import.meta.url));
    const argPath = real(resolve(entryArg));
    return modulePath === argPath;
  } catch {
    // If fileURLToPath fails, we're likely in bundled/CJS context.
    return true;
  }
})();

if (isMainModule) {
  void runApp().catch((error: unknown) => {
    logger.error('Fatal startup error', error);
    rl.close();
    process.exitCode = 1;
  });
}

export default runApp;
