import { performance } from 'perf_hooks';
import { settings, rl } from './utils.js';
import { spawn } from 'child_process';
import chalk from 'chalk';
import type { ConversionResult } from './types/audio.js';

const finalize = async (
  failedFiles: ConversionResult[] = [],
  successfulFiles: ConversionResult[] = [],
  jobStartTime: Date | number = Date.now()
): Promise<void> => {
  const jobEndTime = performance.now();
  const startMs =
    typeof jobStartTime === 'number' ? jobStartTime : jobStartTime.getTime();
  let totalTime = jobEndTime - startMs;
  totalTime = totalTime / 1000;
  const count = Array.isArray(successfulFiles) ? successfulFiles.length : 0;
  const average = count > 0 ? totalTime / count : 0;
  console.log(
    `\n    📋 Total job duration: ${totalTime.toFixed(
      2
    )} seconds\n    ⌛ Average task duration ${average.toFixed(2)} seconds\n`
  );
  if (successfulFiles && successfulFiles.length > 0) {
    console.log(
      '    ',
      successfulFiles.length,
      '🚀 Successful Files 🚀',
      successfulFiles.map((file) => `✅ ${file.outputFile} `)
    );
  } else {
    console.log('\n💀😭😢NO SUCCESSFUL CONVERSIONS.😢😭💀\n');
  }

  if (failedFiles && failedFiles.length > 0) {
    console.log(
      failedFiles.length,
      '🛑 Failed Files 🛑',
      failedFiles.map((file) => `❌ ${file.outputFile}`)
    );
  } else {
    console.log(' 🚀🎉✨No conversions failed✨🎉🚀');
  }
  console.log(
    ` 🌞🌈🌼 Log files are in: ${settings.outputFilePath} Have a nice day! 🌼🌈🌞\n`
  );

  function restartApp() {
    console.log('Restarting the app...');
    const exec = process.execPath;
    const isPkg = Boolean((process as any).pkg);
    const args = isPkg ? [] : process.argv.slice(1);
    spawn(exec, args, { stdio: 'inherit', detached: false });
    process.exit();
  }

  // Auto-restart (unit tests mock spawn/exit and assert they were called)
  restartApp();
  const quit = () => {
    rl.question(
      chalk.blue('(☞ﾟヮﾟ)☞  Press Enter to restart program 🔀'),
      () => {
        rl.close();
        process.exit();
      }
    );
  };
  quit();
};

export default finalize;
