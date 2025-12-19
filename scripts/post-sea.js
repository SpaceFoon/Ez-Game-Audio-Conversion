#!/usr/bin/env node

import { execSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const releaseDir = join(rootDir, 'release');
const stageDir = join(releaseDir, 'package');
const readmesDir = join(stageDir, 'readmes');
const isWindows = platform() === 'win32';
const executableName = isWindows ? 'EZ-Game-Audio.exe' : 'EZ-Game-Audio';
const builtExePath = join(releaseDir, executableName);

function posixPath(p) {
  return p.split('\\').join('/');
}

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function safeRemove(target) {
  if (!existsSync(target)) return;
  try {
    rmSync(target, { recursive: true, force: true });
  } catch (error) {
    console.warn(`[post-sea] Unable to remove ${target}:`, error.message);
  }
}

function emptyDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

function ensureFile(filePath, message) {
  if (!existsSync(filePath)) {
    throw new Error(message);
  }
}

function cleanupIntermediateArtifacts() {
  console.log('[post-sea] Cleaning up intermediate files...');
  // Remove staging/temp artifacts but keep runnable binaries in release/ for smoke tests.
  safeRemove(stageDir);
  safeRemove(join(releaseDir, 'app.bundle.cjs'));
  safeRemove(join(releaseDir, 'sea-prep.blob'));
  safeRemove(join(releaseDir, 'smoke-temp'));
}

function ensureDocsStaged({ requirePdf }) {
  const requiredDocs = ['README.html'];
  if (requirePdf) {
    requiredDocs.push('README.pdf');
  }
  const missing = requiredDocs.filter((name) => !existsSync(join(readmesDir, name)));
  if (missing.length > 0) {
    throw new Error(
      `[post-sea] Missing documentation files in ${readmesDir}: ${missing.join(
        ', '
      )}`
    );
  }
}

function generateChecksum(filePath) {
  if (!existsSync(filePath)) {
    console.warn(`[post-sea] Cannot create checksum; file not found: ${filePath}`);
    return null;
  }
  try {
    const fileBuffer = readFileSync(filePath);
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    const checksumPath = `${filePath}.sha256`;
    const lineEnding = isWindows ? '\r\n' : '\n';
    writeFileSync(
      checksumPath,
      `${hash} *${basename(filePath)}${lineEnding}`
    );
    return checksumPath;
  } catch (error) {
    console.warn(
      `[post-sea] Unable to generate checksum for ${filePath}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

console.log('\n[post-sea] Preparing release artifacts...');
ensureFile(
  builtExePath,
  'SEA executable not found. Run npm run build:sea first.'
);
const artifactPaths = [];
let releaseReady = false;

try {
  // Stage directory structure
  console.log('[post-sea] Staging files...');
  emptyDir(stageDir);
  mkdirSync(readmesDir, { recursive: true });

  // Copy executable into stage
  copyFileSync(builtExePath, join(stageDir, executableName));

  // Copy bundled worker file (from release/dist, not the TypeScript dist/)
  console.log('[post-sea] Copying bundled worker file...');
  const bundledWorkerDir = join(releaseDir, 'dist');
  if (existsSync(bundledWorkerDir)) {
    copyDir(bundledWorkerDir, join(stageDir, 'dist'));
  } else {
    console.warn('[post-sea] Warning: Bundled worker not found at release/dist');
  }

  // Copy ffmpeg binaries (entire folder to mirror legacy behavior)
  const ffmpegSource = join(rootDir, 'ffmpeg-bin');
  if (existsSync(ffmpegSource)) {
    console.log('[post-sea] Copying ffmpeg-bin directory...');
    copyDir(ffmpegSource, join(stageDir, 'ffmpeg-bin'));
  } else {
    console.warn('[post-sea] Warning: ffmpeg-bin directory not found.');
  }

  // Copy Windows helper scripts to stage root
  const helperScripts = [
    'src/windows-functions/add_context_menu.bat',
    'src/windows-functions/remove_context_menu.bat',
  ];
  helperScripts.forEach((relativePath) => {
    const source = join(rootDir, relativePath);
    if (existsSync(source)) {
      copyFileSync(
        source,
        join(stageDir, relativePath.split(/[\\/]/).pop() || '')
      );
    }
  });

  // Generate documentation
  console.log('[post-sea] Generating documentation...');
  try {
    execSync(
      `npx markdown-to-html --source README.md --output "${posixPath(
        join(readmesDir, 'README.html')
      )}"`,
      { cwd: rootDir, stdio: 'inherit' }
    );
  } catch (error) {
    console.warn('[post-sea] Unable to create README.html:', error.message);
  }

  const shouldSkipPdf = process.env.POST_SEA_SKIP_PDF === '1';
  const wkhtmlLocations = [
    'wkhtmltopdf',
    'C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe',
    'C:\\Program Files (x86)\\wkhtmltopdf\\bin\\wkhtmltopdf.exe',
    '/usr/local/bin/wkhtmltopdf',
    '/usr/bin/wkhtmltopdf',
  ];

  function findWkhtmltopdf() {
    for (const candidate of wkhtmlLocations) {
      if (existsSync(candidate)) {
        return candidate;
      }
      try {
        execSync(`"${candidate}" -V`, { stdio: 'ignore' });
        return candidate;
      } catch {
        continue;
      }
    }
    return null;
  }

  if (shouldSkipPdf) {
    console.log(
      '[post-sea] Skipping README.pdf generation (POST_SEA_SKIP_PDF=1)'
    );
  } else {
    const wkhtml = findWkhtmltopdf();
    if (!wkhtml) {
      console.warn(
        '[post-sea] wkhtmltopdf not found on PATH. Skipping PDF generation.'
      );
    } else {
      try {
        const pdfDest = join(readmesDir, 'README.pdf');
        execSync(`"${wkhtml}" README.md "${pdfDest}"`, {
          cwd: rootDir,
          stdio: 'inherit',
        });
      } catch (error) {
        console.warn(
          '[post-sea] wkhtmltopdf failed to create README.pdf:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  // Copy existing docs/readmes if present
  const legacyDocsDir = join(rootDir, 'docs', 'readmes');
  if (existsSync(legacyDocsDir)) {
    copyDir(legacyDocsDir, readmesDir);
  }

  ensureDocsStaged({ requirePdf: !shouldSkipPdf });

  // Create ZIP archive from staged folder
  const zipPath = join(releaseDir, 'EZ-Game-Audio-Conversion.zip');
  safeRemove(zipPath);
  console.log('[post-sea] Creating ZIP archive...');
  if (isWindows) {
    execSync(
      `powershell -Command "Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${zipPath}' -Force -CompressionLevel Optimal"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd "${stageDir}" && zip -qr "${zipPath}" *`, {
      stdio: 'inherit',
      shell: '/bin/bash',
    });
  }

  artifactPaths.push(zipPath);
  const zipChecksum = generateChecksum(zipPath);
  if (zipChecksum) {
    artifactPaths.push(zipChecksum);
  }

  // Create 7z archive on Windows (if 7z is installed)
  if (isWindows) {
    const sevenZipPaths = [
      'C:\\Program Files\\7-Zip\\7z.exe',
      'C:\\Program Files\\7-Zip\\7zG.exe',
      'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    ];
    const sevenZip = sevenZipPaths.find((candidate) => existsSync(candidate));
    if (sevenZip) {
      const sevenPath = join(releaseDir, 'EZ-Game-Audio-Conversion.7z');
      const tempSeven = `${sevenPath}.tmp`;
      safeRemove(tempSeven);
      console.log('[post-sea] Creating 7z archive...');
      execSync(
        `"${sevenZip}" a -t7z -m0=lzma2 -mx=9 -mfb=64 -md=32m -ms=on "${tempSeven}" "${stageDir}\\*"`,
        { stdio: 'inherit' }
      );
    safeRemove(sevenPath);
    try {
      renameSync(tempSeven, sevenPath);
      artifactPaths.push(sevenPath);
      const sevenChecksum = generateChecksum(sevenPath);
      if (sevenChecksum) {
        artifactPaths.push(sevenChecksum);
      }
    } catch {
      const fallback = join(
        releaseDir,
        `EZ-Game-Audio-Conversion-${Date.now()}.7z`
      );
      renameSync(tempSeven, fallback);
      artifactPaths.push(fallback);
      const fallbackChecksum = generateChecksum(fallback);
      if (fallbackChecksum) {
        artifactPaths.push(fallbackChecksum);
      }
      console.warn(
        `[post-sea] Existing .7z archive is in use. Saved new file as ${fallback}`
      );
      }
    } else {
      console.warn('[post-sea] 7-Zip not found. Skipping .7z archive.');
    }
  }

  releaseReady = true;
} finally {
  cleanupIntermediateArtifacts();
}

if (releaseReady) {
  console.log('\n[post-sea] Release artifacts ready:');
  artifactPaths.forEach((artifact) => console.log(`  - ${artifact}`));
  console.log(
    'Distribute the ZIP/7z contents just like the original build.bat output.'
  );
}
