#!/usr/bin/env node

/**
 * Build script for creating Single Executable Applications (SEA) with Node.js 24+
 *
 * SEA allows bundling the Node.js binary with the application into a single executable.
 * This is the modern replacement for pkg.
 */

import { execSync } from 'child_process';
import { copyFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

const isWindows = platform() === 'win32';
const APP_NAME = 'ez-game-audio';
const RELEASE_DIR = 'release';
const SEA_CONFIG_PATH = 'sea-config.json';
const SEA_BLOB_PATH = join(RELEASE_DIR, 'sea-prep.blob');
const OUTPUT_EXE = join(RELEASE_DIR, isWindows ? `${APP_NAME}.exe` : APP_NAME);

console.log('[SEA] Building Single Executable Application...\n');

// Step 1: Ensure release directory exists
console.log('[SEA] Ensuring release directory exists...');
mkdirSync(RELEASE_DIR, { recursive: true });

// Step 2: Create SEA configuration
console.log('[SEA] Writing sea-config.json...');
const seaConfig = {
  main: 'dist/app.js',
  output: SEA_BLOB_PATH,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
};
writeFileSync(SEA_CONFIG_PATH, JSON.stringify(seaConfig, null, 2));

// Step 3: Generate SEA blob
console.log('[SEA] Generating SEA blob...');
try {
  execSync(`node --experimental-sea-config ${SEA_CONFIG_PATH}`, {
    stdio: 'inherit',
  });
} catch (error) {
  console.error('[SEA] Failed to generate SEA blob');
  process.exit(1);
}

// Step 4: Copy Node.js executable
console.log('[SEA] Copying Node.js executable...');
try {
  copyFileSync(process.execPath, OUTPUT_EXE);
} catch (error) {
  console.error('[SEA] Failed to copy Node.js executable:', error.message);
  process.exit(1);
}

// Step 5: Inject the blob into the executable
console.log('[SEA] Injecting application into executable...');
try {
  const fuseFlag = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
  const postjectCommand = [
    'npx',
    'postject',
    `"${OUTPUT_EXE}"`,
    'NODE_SEA_BLOB',
    `"${SEA_BLOB_PATH}"`,
    '--sentinel-fuse',
    fuseFlag,
  ];
  if (platform() === 'darwin') {
    postjectCommand.push('--macho-segment-name', 'NODE_SEA');
  }
  execSync(postjectCommand.join(' '), { stdio: 'inherit' });
} catch (error) {
  console.error('[SEA] Failed to inject blob:', error.message);
  console.error('Make sure postject is installed: npm install --save-dev postject');
  process.exit(1);
}

console.log('\n[SEA] Build complete!');
console.log(`[SEA] Executable location: ${OUTPUT_EXE}`);
console.log('[SEA] Remember to place ffmpeg/ffprobe binaries next to the executable before distribution.');
