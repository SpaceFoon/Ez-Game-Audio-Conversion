#!/usr/bin/env node

import { execFileSync } from 'child_process';

const isNpmRunInstall = process.env.npm_command === 'run-script';

const run = (command, args) => {
  execFileSync(command, args, { stdio: 'inherit' });
};

// Run npm through node + npm's own CLI script (npm sets npm_execpath).
// Spawning npm.cmd directly fails on Windows: Node 20.12+ refuses to run
// .cmd files without a shell (EINVAL).
const runNpm = (args) => {
  const npmCli = process.env.npm_execpath;
  if (npmCli && /\.c?js$/i.test(npmCli)) {
    run(process.execPath, [npmCli, ...args]);
  } else {
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  }
};

if (isNpmRunInstall) {
  console.log('[install] Installing npm dependencies...');
  runNpm(['install', '--ignore-scripts']);
}

console.log('[install] Installing FFmpeg binaries...');
run(process.execPath, ['scripts/install-ffmpeg.js']);
