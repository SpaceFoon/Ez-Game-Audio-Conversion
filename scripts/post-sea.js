#!/usr/bin/env node

import { execSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  linkSync,
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
const isHostWindows = platform() === 'win32';

// Detect if we're building for Windows (even when running in WSL)
// Check for existing .exe file first, then fall back to platform detection
function detectExecutableName() {
  const winExeName = 'EZ-Game-Audio.exe';
  const unixExeName = 'EZ-Game-Audio';

  // Check which executable actually exists in the release directory
  if (existsSync(join(releaseDir, winExeName))) {
    return winExeName;
  }
  if (existsSync(join(releaseDir, unixExeName))) {
    // If we're on a non-Windows platform but have a non-.exe file,
    // check if we should be building for Windows (e.g., running in WSL)
    // For safety, always use .exe for Windows distribution
    console.log(
      '[post-sea] Found executable without .exe extension. Renaming for Windows compatibility.'
    );
    try {
      renameSync(join(releaseDir, unixExeName), join(releaseDir, winExeName));
      return winExeName;
    } catch (err) {
      console.warn('[post-sea] Could not rename executable:', err.message);
      return unixExeName;
    }
  }

  // Fallback to platform detection
  return isHostWindows ? winExeName : unixExeName;
}

const executableName = detectExecutableName();
const builtExePath = join(releaseDir, executableName);

const packageVersion = getPackageVersion();

// Deterministic policy (no flags):
// - CI: keep legacy (unversioned) filenames for workflows
// - Local: produce versioned archives only
const createLegacyNames = isCI();

// The host OS (where this script runs) can differ from the target executable
// we're packaging (e.g., building a Windows .exe from WSL). Use the executable
// name to decide packaging behavior.
const isTargetWindows = executableName.toLowerCase().endsWith('.exe');
const targetPlatformSlug = isTargetWindows
  ? 'windows'
  : platform() === 'darwin'
    ? 'macos'
    : 'linux';

function getPackageVersion() {
  try {
    const pkgPath = join(rootDir, 'package.json');
    const raw = readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch (error) {
    console.warn(
      '[post-sea] Unable to read package.json version:',
      error instanceof Error ? error.message : String(error)
    );
    return '0.0.0';
  }
}

function isCI() {
  return (
    process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.BUILD_BUILDID !== undefined
  );
}

function tryUpdateLegacyAlias({ sourcePath, legacyPath, label }) {
  if (!existsSync(sourcePath)) {
    console.warn(
      `[post-sea] Cannot create legacy alias for ${label}; source missing: ${sourcePath}`
    );
    return false;
  }

  // Best-effort: replace legacyPath if it exists. If it's locked (Explorer preview,
  // AV scan, 7-Zip open, etc), skip without spamming multiple warnings.
  if (existsSync(legacyPath)) {
    try {
      rmSync(legacyPath, { force: true });
    } catch (error) {
      console.warn(
        `[post-sea] Legacy ${label} appears locked; leaving it unchanged: ${legacyPath}`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  try {
    linkSync(sourcePath, legacyPath);
    return true;
  } catch {
    try {
      copyFileSync(sourcePath, legacyPath);
      return true;
    } catch (error) {
      console.warn(
        `[post-sea] Unable to update legacy ${label} at ${legacyPath} (file may be in use):`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }
}

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

function removeFilesMatching(dir, namePattern) {
  if (!existsSync(dir)) return;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!namePattern.test(entry.name)) continue;
      safeRemove(join(dir, entry.name));
    }
  } catch (error) {
    console.warn(
      `[post-sea] Unable to scan ${dir} for cleanup:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

function ensureFile(filePath, message) {
  if (!existsSync(filePath)) {
    throw new Error(message);
  }
}

function cleanupIntermediateArtifacts() {
  console.log('[post-sea] Cleaning up intermediate files...');
  // Remove staging/temp artifacts.
  safeRemove(stageDir);
  safeRemove(join(releaseDir, 'app.bundle.cjs'));
  safeRemove(join(releaseDir, 'sea-prep.blob'));
  safeRemove(join(releaseDir, 'smoke-temp'));
  // Clean up any leftover folders from old builds
  safeRemove(join(releaseDir, 'EZ-Game-Audio-Conversion'));

  // Clean up loose artifacts that should live only inside archives.
  safeRemove(join(releaseDir, 'dist'));
  safeRemove(join(releaseDir, 'ffmpeg-bin'));
  safeRemove(join(releaseDir, 'readmes'));
  safeRemove(join(releaseDir, 'add_context_menu.bat'));
  safeRemove(join(releaseDir, 'remove_context_menu.bat'));
  safeRemove(join(releaseDir, 'exe_run.log'));

  // Clean up old timestamped fallback archives from earlier script versions.
  removeFilesMatching(releaseDir, /^EZ-Game-Audio-Conversion-\d+\.7z$/i);
  removeFilesMatching(
    releaseDir,
    /^EZ-Game-Audio-Conversion-\d+\.7z\.sha256$/i
  );

  // Local runs should be versioned-only; remove legacy unversioned files from prior runs.
  if (!isCI()) {
    safeRemove(join(releaseDir, 'EZ-Game-Audio-Conversion.zip'));
    safeRemove(join(releaseDir, 'EZ-Game-Audio-Conversion.zip.sha256'));
    safeRemove(join(releaseDir, 'EZ-Game-Audio-Conversion.7z'));
    safeRemove(join(releaseDir, 'EZ-Game-Audio-Conversion.7z.sha256'));
  }

  // Keep the release folder clean: the runnable distribution is inside the archives.
  safeRemove(builtExePath);
}

function ensureDocsStaged({ requirePdf }) {
  const requiredDocs = ['README.html'];
  if (requirePdf) {
    requiredDocs.push('README.pdf');
  }
  const missing = requiredDocs.filter(
    (name) => !existsSync(join(readmesDir, name))
  );
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
    console.warn(
      `[post-sea] Cannot create checksum; file not found: ${filePath}`
    );
    return null;
  }
  try {
    const fileBuffer = readFileSync(filePath);
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    const checksumPath = `${filePath}.sha256`;
    const lineEnding = isTargetWindows ? '\r\n' : '\n';
    writeFileSync(checksumPath, `${hash} *${basename(filePath)}${lineEnding}`);
    return checksumPath;
  } catch (error) {
    console.warn(
      `[post-sea] Unable to generate checksum for ${filePath}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

function computeSha256(filePath) {
  if (!existsSync(filePath)) {
    console.warn(
      `[post-sea] Cannot compute SHA256; file not found: ${filePath}`
    );
    return '';
  }
  try {
    const fileBuffer = readFileSync(filePath);
    return createHash('sha256').update(fileBuffer).digest('hex');
  } catch (error) {
    console.warn(
      `[post-sea] Unable to compute SHA256 for ${filePath}:`,
      error instanceof Error ? error.message : String(error)
    );
    return '';
  }
}

function writeUpdateManifest(artifacts) {
  const version = getPackageVersion();
  const publishedAt = new Date().toISOString();
  const files = artifacts
    .filter((filePath) => /\.(zip|7z)$/i.test(filePath))
    .map((filePath) => {
      const fileName = basename(filePath);
      const sha256 = computeSha256(filePath);
      return {
        file: fileName,
        sha256,
      };
    })
    .filter((entry) => entry.sha256 !== ''); // Exclude files with failed SHA256 computation

  if (files.length === 0) return;

  const manifest = {
    version,
    publishedAt,
    files,
  };

  const manifestPath = join(releaseDir, 'update.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  artifactPaths.push(manifestPath);
}

console.log('\n[post-sea] Preparing release artifacts...');
ensureFile(
  builtExePath,
  'SEA executable not found. Run npm run build:sea first.'
);
const artifactPaths = [];
const manifestArtifactPaths = [];
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
    console.warn(
      '[post-sea] Warning: Bundled worker not found at release/dist'
    );
  }

  // Copy ffmpeg binaries (entire folder to mirror legacy behavior)
  const ffmpegSource = join(rootDir, 'ffmpeg-bin');
  if (existsSync(ffmpegSource)) {
    console.log(`[post-sea] Copying ffmpeg-bin for ${targetPlatformSlug}...`);
    const ffmpegDest = join(stageDir, 'ffmpeg-bin');
    mkdirSync(ffmpegDest, { recursive: true });

    const ffmpegReadme = join(ffmpegSource, 'README.md');
    if (existsSync(ffmpegReadme)) {
      copyFileSync(ffmpegReadme, join(ffmpegDest, 'README.md'));
    }

    const platformDir = join(ffmpegSource, targetPlatformSlug);
    if (existsSync(platformDir)) {
      copyDir(platformDir, join(ffmpegDest, targetPlatformSlug));
    } else {
      console.warn(
        `[post-sea] Warning: ffmpeg-bin/${targetPlatformSlug} not found.`
      );
    }
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
  const shouldRequirePdf = process.env.POST_SEA_REQUIRE_PDF === '1';
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

  // Ensure README assets are available for both ZIP and PDF rendering.
  const repoMediaDir = join(rootDir, 'media');
  if (existsSync(repoMediaDir)) {
    copyDir(repoMediaDir, join(readmesDir, 'media'));
  }

  // Copy existing docs/readmes if present
  const legacyDocsDir = join(rootDir, 'docs', 'readmes');
  if (existsSync(legacyDocsDir)) {
    // Do not overwrite the freshly generated README.html/README.pdf.
    // The legacy versions can contain stale asset paths.
    const entries = readdirSync(legacyDocsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (/^README\.(html|pdf)$/i.test(entry.name)) continue;
      copyFileSync(
        join(legacyDocsDir, entry.name),
        join(readmesDir, entry.name)
      );
    }
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
        const htmlSource = join(readmesDir, 'README.html');
        const pdfDest = join(readmesDir, 'README.pdf');
        // wkhtmltopdf does not understand Markdown directly. Render the generated
        // README.html instead, and allow local file access for any assets.
        execSync(
          `"${wkhtml}" --enable-local-file-access --load-error-handling ignore "${htmlSource}" "${pdfDest}"`,
          { cwd: rootDir, stdio: 'inherit' }
        );
      } catch (error) {
        console.warn(
          '[post-sea] wkhtmltopdf failed to create README.pdf:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  ensureDocsStaged({ requirePdf: shouldRequirePdf && !shouldSkipPdf });

  // Create ZIP archive from staged folder
  const legacyZipPath = join(releaseDir, 'EZ-Game-Audio-Conversion.zip');
  const versionedZipPath = join(
    releaseDir,
    `EZ-Game-Audio-Conversion-v${packageVersion}.zip`
  );

  // Create the versioned ZIP first (to avoid issues overwriting a locked legacy file).
  const zipPath = createLegacyNames ? legacyZipPath : versionedZipPath;
  safeRemove(zipPath);
  console.log('[post-sea] Creating ZIP archive...');
  if (isTargetWindows || isHostWindows) {
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
  manifestArtifactPaths.push(zipPath);
  const zipChecksum = generateChecksum(zipPath);
  if (zipChecksum) {
    artifactPaths.push(zipChecksum);
  }

  // Also produce legacy (unversioned) name for compatibility (tests/workflows).
  if (createLegacyNames && zipPath !== legacyZipPath) {
    const ok = tryUpdateLegacyAlias({
      sourcePath: zipPath,
      legacyPath: legacyZipPath,
      label: 'ZIP',
    });
    if (ok) {
      artifactPaths.push(legacyZipPath);
      const legacyZipChecksum = generateChecksum(legacyZipPath);
      if (legacyZipChecksum) {
        artifactPaths.push(legacyZipChecksum);
      }
    }
  }

  // Create 7z archive on Windows (if 7z is installed)
  if (isTargetWindows || isHostWindows) {
    const sevenZipPaths = [
      'C:\\Program Files\\7-Zip\\7z.exe',
      'C:\\Program Files\\7-Zip\\7zG.exe',
      'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    ];
    const sevenZip = sevenZipPaths.find((candidate) => existsSync(candidate));
    if (sevenZip) {
      const legacySevenPath = join(releaseDir, 'EZ-Game-Audio-Conversion.7z');
      const versionedSevenPath = join(
        releaseDir,
        `EZ-Game-Audio-Conversion-v${packageVersion}.7z`
      );
      const sevenPath = createLegacyNames
        ? legacySevenPath
        : versionedSevenPath;

      const tempSeven = join(
        releaseDir,
        `${basename(sevenPath)}.${Date.now()}.tmp`
      );
      safeRemove(tempSeven);
      console.log('[post-sea] Creating 7z archive...');
      execSync(
        `"${sevenZip}" a -t7z -m0=lzma2 -mx=9 -mfb=64 -md=32m -ms=on "${tempSeven}" "${stageDir}\\*"`,
        { stdio: 'inherit' }
      );

      safeRemove(sevenPath);
      renameSync(tempSeven, sevenPath);

      artifactPaths.push(sevenPath);
      manifestArtifactPaths.push(sevenPath);
      const sevenChecksum = generateChecksum(sevenPath);
      if (sevenChecksum) {
        artifactPaths.push(sevenChecksum);
      }

      // Also produce legacy (unversioned) name for compatibility (tests/workflows).
      if (createLegacyNames && sevenPath !== legacySevenPath) {
        const ok = tryUpdateLegacyAlias({
          sourcePath: sevenPath,
          legacyPath: legacySevenPath,
          label: '7z',
        });
        if (ok) {
          artifactPaths.push(legacySevenPath);
          const legacySevenChecksum = generateChecksum(legacySevenPath);
          if (legacySevenChecksum) {
            artifactPaths.push(legacySevenChecksum);
          }
        }
      }
    } else {
      console.warn('[post-sea] 7-Zip not found. Skipping .7z archive.');
    }
  }

  writeUpdateManifest(manifestArtifactPaths);
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
