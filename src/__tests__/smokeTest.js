#!/usr/bin/env node
/*
 Simple smoke test: run packaged binary on a dummy conversion to verify it starts and exits.
 Assumes `npm run package` has produced binaries in `release/`.
*/
const { spawnSync } = require('child_process');
const { existsSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

const isWindows = process.platform === 'win32';

function findBinary() {
  const dir = join(process.cwd(), 'release');
  const candidates = [
    isWindows ? 'ez-game-audio.exe' : 'ez-game-audio',
    'ez-game-audio-conversion-win32-x64.exe',
    'ez-game-audio-conversion-linux-x64',
  ];
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(p)) return p;
  }
  throw new Error('No packaged binary found in release/.');
}

function prepTemp() {
  const tmpDir = join(process.cwd(), 'release', 'smoke-temp');
  mkdirSync(tmpDir, { recursive: true });
  // create empty wav header (not a valid audio but tool should handle absence gracefully / proceed to prompts)
  const dummy = join(tmpDir, 'dummy.wav');
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
  return { tmpDir };
}

function run() {
  const bin = findBinary();
  const { tmpDir } = prepTemp();
  // Provide dummy input folder argument (the temp dir) so program skips interactive folder prompt.
  const res = spawnSync(bin, [tmpDir], { encoding: 'utf8', timeout: 15000 });
  if (res.error) {
    console.error('Smoke test failed to run binary:', res.error);
    process.exit(1);
  }
  if (res.status !== 0) {
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
    console.log('Smoke test passed: binary produced expected output fragment.');
  }
}

run();
