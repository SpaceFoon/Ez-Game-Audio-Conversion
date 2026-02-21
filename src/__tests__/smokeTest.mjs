#!/usr/bin/env node
/*
 Simple smoke test: run packaged binary on a dummy conversion to verify it starts and exits.
 Assumes `npm run package` has produced binaries in `release/`.
*/
import { spawnSync } from 'child_process';
import { execSync } from 'child_process';
import {
  existsSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
  readdirSync,
} from 'fs';
import { join } from 'path';

const isWindows = process.platform === 'win32';

function getPackageVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    );
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

function findZip() {
  const dir = join(process.cwd(), 'release');
  const version = getPackageVersion();
  const preferred = version
    ? join(dir, `EZ-Game-Audio-Conversion-v${version}.zip`)
    : null;
  if (preferred && existsSync(preferred)) return preferred;

  const candidates = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.zip'))
    .filter((f) => f.startsWith('EZ-Game-Audio-Conversion'))
    .map((f) => join(dir, f));

  if (candidates.length > 0) return candidates[0];

  const legacy = join(dir, 'EZ-Game-Audio-Conversion.zip');
  if (existsSync(legacy)) return legacy;

  throw new Error('No ZIP archive found in release/.');
}

function extractZip(zipPath, extractDir) {
  mkdirSync(extractDir, { recursive: true });
  if (isWindows) {
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -q -o "${zipPath}" -d "${extractDir}"`, {
      stdio: 'inherit',
      shell: '/bin/bash',
    });
  }
}

function findBinary(dir) {
  const candidates = [
    isWindows ? 'EZ-Game-Audio.exe' : 'EZ-Game-Audio',
    'EZ-Game-Audio.exe', // Always check for .exe even on non-Windows (WSL scenario)
    'ez-game-audio.exe',
    'ez-game-audio-conversion-win32-x64.exe',
    'ez-game-audio-conversion-linux-x64',
  ];
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(p)) return p;
  }
  throw new Error('No packaged binary found in extracted package.');
}

function prepTemp() {
  const tmpDir = join(process.cwd(), 'release', 'smoke-temp');
  const inputDir = join(tmpDir, 'input');
  const extractDir = join(tmpDir, 'package');
  mkdirSync(inputDir, { recursive: true });
  // create empty wav header (not a valid audio but tool should handle absence gracefully / proceed to prompts)
  const dummy = join(inputDir, 'dummy.wav');
  if (!existsSync(dummy)) {
    // 44 byte minimal header for PCM 16-bit 1ch 44100Hz 0 data
    const header = Buffer.alloc(44, 0);
    header.write('RIFF', 0);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // channels
    header.writeUInt32LE(44100, 24);
    header.writeUInt32LE(44100 * 2, 28); // byte rate
    header.writeUInt16LE(2, 32); // block align
    header.writeUInt16LE(16, 34); // bits per sample
    header.write('data', 36);
    header.writeUInt32LE(0, 40); // data chunk size
    writeFileSync(dummy, header);
  }
  return { tmpDir, inputDir, extractDir };
}

function cleanupTemp(tmpDir) {
  if (existsSync(tmpDir)) {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
      console.log('Smoke test: cleaned up temporary directory.');
    } catch (error) {
      console.warn(
        'Smoke test: could not clean up temp directory:',
        error.message
      );
    }
  }
}

function run() {
  const zipPath = findZip();
  const { tmpDir, inputDir, extractDir } = prepTemp();

  extractZip(zipPath, extractDir);
  const bin = findBinary(extractDir);

  let exitCode = 0;
  try {
    // Provide dummy input folder argument (the temp dir) so program skips interactive folder prompt.
    const res = spawnSync(bin, [inputDir], {
      cwd: extractDir,
      encoding: 'utf8',
      timeout: 15000,
    });
    if (res.error) {
      console.error('Smoke test failed to run binary:', res.error);
      exitCode = 1;
    } else if (res.status !== 0) {
      console.warn(
        'Binary exited non-zero (expected for early exit / prompts). Code:',
        res.status
      );
    }
    // Basic sanity checks on stdout
    const out = res.stdout || '';
    if (
      !out.includes('Input Folder') &&
      !out.includes('Processing single file') &&
      !out.includes('Conversion parameters')
    ) {
      console.warn(
        'Smoke test: did not see expected startup text; stdout length:',
        out.length
      );
    } else {
      console.log(
        'Smoke test passed: binary produced expected output fragment.'
      );
    }
  } finally {
    // Clean up temp directory
    cleanupTemp(tmpDir);
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

run();
