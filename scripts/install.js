#!/usr/bin/env node

import { execFileSync } from 'child_process';

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const isNpmRunInstall = process.env.npm_command === 'run-script';

const run = (command, args) => {
  execFileSync(command, args, { stdio: 'inherit' });
};

if (isNpmRunInstall) {
  console.log('[install] Installing npm dependencies...');
  run(npmExecutable, ['install', '--ignore-scripts']);
}

console.log('[install] Installing FFmpeg binaries...');
run(process.execPath, ['scripts/install-ffmpeg.js']);
