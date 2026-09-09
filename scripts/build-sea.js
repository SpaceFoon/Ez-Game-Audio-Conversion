#!/usr/bin/env node

/**
 * Build script for creating Single Executable Applications (SEA) with Node.js 24+
 *
 * SEA allows bundling the Node.js binary with the application into a single executable.
 * This is the modern replacement for pkg.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

const isWindows = platform() === 'win32';
const APP_NAME = 'EZ-Game-Audio';
const RELEASE_DIR = 'release';
const BUNDLED_APP = join(RELEASE_DIR, 'app.bundle.cjs');
const SEA_CONFIG_PATH = 'sea-config.json';
const SEA_BLOB_PATH = join(RELEASE_DIR, 'sea-prep.blob');
const OUTPUT_EXE = join(RELEASE_DIR, isWindows ? `${APP_NAME}.exe` : APP_NAME);
const PACKAGE_VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

function tryApplyWindowsIcon() {
  if (!isWindows) return;
  if (process.env.POST_SEA_SKIP_ICON === '1') {
    console.log('[SEA] Skipping icon injection (POST_SEA_SKIP_ICON=1)');
    return;
  }

  const iconScript = join('src', 'ico', 'icon.js');
  if (!existsSync(iconScript)) {
    console.warn('[SEA] Icon script not found; skipping icon injection');
    return;
  }

  console.log('[SEA] Applying Windows icon + version metadata...');
  try {
    execSync(`node "${iconScript}" "${OUTPUT_EXE}"`, { stdio: 'inherit' });
  } catch (error) {
    console.warn(
      '[SEA] Warning: icon injection failed (continuing):',
      error.message
    );
  }
}

console.log('[SEA] Building Single Executable Application...\n');

// Step 1: Ensure release directory exists
console.log('[SEA] Ensuring release directory exists...');
mkdirSync(RELEASE_DIR, { recursive: true });

// Step 1.5: Bundle ESM to CJS for SEA compatibility
// The code handles import.meta being empty by falling back to CJS __filename
// Exclude cfonts entirely - it uses dynamic require for fonts that can't work in SEA
console.log('[SEA] Injecting banner snapshot...');
try {
  execSync('node scripts/gen-banner.js', { stdio: 'inherit' });
} catch (error) {
  console.error('[SEA] Failed to generate banner snapshot:', error.message);
  process.exit(1);
}

console.log('[SEA] Bundling application with esbuild...');
try {
  execSync(
    `npx esbuild dist/app.js --bundle --platform=node --format=cjs --minify --tree-shaking=true --legal-comments=none --outfile=${BUNDLED_APP} --external:worker_threads --external:cfonts --define:__SEA_BUILD__=true --define:__APP_VERSION__=${JSON.stringify(PACKAGE_VERSION)} --log-override:empty-import-meta=silent`,
    {
      stdio: 'inherit',
    }
  );
} catch (error) {
  console.error('[SEA] Failed to bundle application:', error.message);
  process.exit(1);
}

// Step 2: Create SEA configuration
console.log('[SEA] Writing sea-config.json...');
const seaConfig = {
  main: BUNDLED_APP,
  output: SEA_BLOB_PATH,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
};
writeFileSync(SEA_CONFIG_PATH, JSON.stringify(seaConfig, null, 2));

// Step 2.5: Bundle and copy worker file (workers can't be inlined in SEA)
console.log('[SEA] Bundling worker file...');
// Use .cjs so the worker is always CommonJS, even if extracted under a
// "type":"module" package scope (e.g., extracting into the repo folder).
const WORKER_BUNDLE = join(RELEASE_DIR, 'dist', 'converterWorker.cjs');
mkdirSync(join(RELEASE_DIR, 'dist'), { recursive: true });
try {
  execSync(
    `npx esbuild dist/converterWorker.js --bundle --platform=node --format=cjs --minify --tree-shaking=true --legal-comments=none --outfile=${WORKER_BUNDLE} --log-override:empty-import-meta=silent`,
    {
      stdio: 'inherit',
    }
  );
} catch (error) {
  console.error('[SEA] Failed to bundle worker:', error.message);
  process.exit(1);
}

// Step 3: Generate SEA blob
console.log('[SEA] Generating SEA blob...');
try {
  execSync(`node --experimental-sea-config ${SEA_CONFIG_PATH}`, {
    stdio: 'inherit',
  });
} catch {
  console.error('[SEA] Failed to generate SEA blob');
  process.exit(1);
}

// Step 4: Copy Node.js executable
console.log('[SEA] Copying Node.js executable...');
try {
  // Use system copy command instead of Node API to avoid file lock issues
  // when npm itself holds the Node.exe lock during package builds
  const copyCmd = isWindows
    ? `cmd /c copy /Y "${process.execPath}" "${OUTPUT_EXE}"`
    : `cp "${process.execPath}" "${OUTPUT_EXE}"`;
  execSync(copyCmd, { stdio: 'inherit' });
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
  console.error(
    'Make sure postject is installed: npm install --save-dev postject'
  );
  process.exit(1);
}

// Step 5.5: Inject custom icon/version info (best-effort)
tryApplyWindowsIcon();

// Step 6: Cleanup temporary files
console.log('[SEA] Cleaning up temporary files...');
try {
  if (existsSync(SEA_BLOB_PATH)) {
    rmSync(SEA_BLOB_PATH);
  }
  if (existsSync(SEA_CONFIG_PATH)) {
    rmSync(SEA_CONFIG_PATH);
  }
} catch {
  console.warn('[SEA] Warning: Could not clean up some temporary files');
}

console.log('\n[SEA] Build complete!');
console.log(`[SEA] Executable location: ${OUTPUT_EXE}`);
console.log(
  '[SEA] Remember to place ffmpeg/ffprobe binaries next to the executable before distribution.'
);