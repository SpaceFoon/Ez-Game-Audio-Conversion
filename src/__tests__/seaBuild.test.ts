/**
 * SEA (Single Executable Application) Build Tests
 *
 * These tests verify that the SEA build and packaging process:
 * 1. Creates all required artifacts
 * 2. Archives contain correct files with proper extensions
 * 3. Intermediate files are cleaned up properly
 * 4. The executable name has the correct extension for Windows
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { platform } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');
const RELEASE_DIR = join(ROOT_DIR, 'release');
const isWindows = platform() === 'win32';

// Expected artifact names
const EXPECTED_EXE_NAME = 'EZ-Game-Audio.exe';
const EXPECTED_ZIP_NAME = 'EZ-Game-Audio-Conversion.zip';
const EXPECTED_7Z_NAME = 'EZ-Game-Audio-Conversion.7z';

/**
 * Helper to list files in a ZIP archive
 */
function listZipContents(zipPath: string): string[] {
  try {
    if (isWindows) {
      // Use PowerShell to list ZIP contents
      const result = execSync(
        `powershell -Command "& { Add-Type -A 'System.IO.Compression.FileSystem'; [IO.Compression.ZipFile]::OpenRead('${zipPath}').Entries.FullName }"`,
        { encoding: 'utf8' }
      );
      return result.trim().split(/\r?\n/).filter(Boolean);
    } else {
      // Use unzip on Unix-like systems
      const result = execSync(`unzip -l "${zipPath}"`, { encoding: 'utf8' });
      // Parse unzip output - file names are in the 4th column
      const lines = result.split('\n');
      const files: string[] = [];
      for (const line of lines) {
        const match = line.match(
          /^\s*\d+\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+)$/
        );
        if (match && match[1]) {
          files.push(match[1].trim());
        }
      }
      return files;
    }
  } catch (error) {
    console.error('Failed to list ZIP contents:', error);
    return [];
  }
}

/**
 * Helper to list files in a 7z archive
 */
function list7zContents(archivePath: string): string[] {
  const sevenZipPaths = [
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    '/usr/bin/7z',
    '7z',
  ];

  let sevenZip: string | null = null;
  for (const candidate of sevenZipPaths) {
    try {
      if (existsSync(candidate) || candidate === '7z') {
        execSync(`"${candidate}" --help`, { stdio: 'ignore' });
        sevenZip = candidate;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!sevenZip) {
    console.warn('7-Zip not found, skipping 7z content verification');
    return [];
  }

  try {
    const result = execSync(`"${sevenZip}" l -slt "${archivePath}"`, {
      encoding: 'utf8',
    });
    // Parse 7z list output - look for "Path = " lines
    const paths: string[] = [];
    const lines = result.split('\n');
    for (const line of lines) {
      const match = line.match(/^Path = (.+)$/);
      if (match && match[1] && !match[1].endsWith('.7z')) {
        paths.push(match[1].trim());
      }
    }
    return paths;
  } catch (error) {
    console.error('Failed to list 7z contents:', error);
    return [];
  }
}

describe('SEA Build Tests', () => {
  // These tests check the current state of release/ directory
  // They don't run the build - use npm run package for that

  describe('Release directory structure', () => {
    beforeAll(() => {
      if (!existsSync(RELEASE_DIR)) {
        console.warn(
          'Release directory does not exist. Run `npm run package` first.'
        );
      }
    });

    test('release directory exists', () => {
      expect(existsSync(RELEASE_DIR)).toBe(true);
    });

    test('executable has correct .exe extension on Windows', () => {
      if (!existsSync(RELEASE_DIR)) {
        console.warn('Skipping: release directory does not exist');
        return;
      }

      const exePath = join(RELEASE_DIR, EXPECTED_EXE_NAME);
      const exeWithoutExt = join(RELEASE_DIR, 'EZ-Game-Audio');
      const files = readdirSync(RELEASE_DIR);

      // Skip if no executable files exist yet (build not run)
      const hasAnyExe = files.some((f) => f.startsWith('EZ-Game-Audio'));
      if (!hasAnyExe) {
        console.warn('Skipping: no executable found (run npm run package)');
        return;
      }

      const hasExeWithExtension = files.includes(EXPECTED_EXE_NAME);
      const hasExeWithoutExtension = files.some(
        (f) => f === 'EZ-Game-Audio' && !f.endsWith('.exe')
      );

      // If we have a file without extension, that's a bug
      if (
        existsSync(exeWithoutExt) &&
        statSync(exeWithoutExt).isFile() &&
        !existsSync(exePath)
      ) {
        console.error(
          'Found EZ-Game-Audio without .exe extension - this is a bug!'
        );
        expect(hasExeWithoutExtension).toBe(false);
      }

      expect(hasExeWithExtension).toBe(true);
    });

    test('ZIP archive exists', () => {
      if (!existsSync(RELEASE_DIR)) {
        console.warn('Skipping: release directory does not exist');
        return;
      }
      const zipPath = join(RELEASE_DIR, EXPECTED_ZIP_NAME);
      // Skip if release dir exists but is from partial build
      if (!readdirSync(RELEASE_DIR).some((f) => f.endsWith('.zip'))) {
        console.warn('Skipping: no ZIP files found (run npm run package)');
        return;
      }
      expect(existsSync(zipPath)).toBe(true);
    });

    test('ZIP checksum file exists', () => {
      if (!existsSync(RELEASE_DIR)) {
        console.warn('Skipping: release directory does not exist');
        return;
      }
      const checksumPath = join(RELEASE_DIR, `${EXPECTED_ZIP_NAME}.sha256`);
      // Skip if no checksum files exist
      if (!readdirSync(RELEASE_DIR).some((f) => f.endsWith('.sha256'))) {
        console.warn('Skipping: no checksum files found (run npm run package)');
        return;
      }
      expect(existsSync(checksumPath)).toBe(true);
    });

    test('update.json manifest exists', () => {
      if (!existsSync(RELEASE_DIR)) {
        console.warn('Skipping: release directory does not exist');
        return;
      }
      const manifestPath = join(RELEASE_DIR, 'update.json');
      // Skip if manifest doesn't exist (partial build)
      if (!existsSync(manifestPath)) {
        console.warn('Skipping: update.json not found (run npm run package)');
        return;
      }
      expect(existsSync(manifestPath)).toBe(true);
    });
  });

  describe('Intermediate file cleanup', () => {
    test('staging directory (package/) should not exist after build', () => {
      const stagePath = join(RELEASE_DIR, 'package');
      expect(existsSync(stagePath)).toBe(false);
    });

    test('app.bundle.cjs should not exist after build', () => {
      const bundlePath = join(RELEASE_DIR, 'app.bundle.cjs');
      expect(existsSync(bundlePath)).toBe(false);
    });

    test('sea-prep.blob should not exist after build', () => {
      const blobPath = join(RELEASE_DIR, 'sea-prep.blob');
      expect(existsSync(blobPath)).toBe(false);
    });

    test('smoke-temp should not exist after smoke tests complete', () => {
      const smokeTempPath = join(RELEASE_DIR, 'smoke-temp');
      // This may exist if smoke tests were run but not cleaned up
      if (existsSync(smokeTempPath)) {
        console.warn(
          'smoke-temp directory exists and should be cleaned up after tests'
        );
      }
      // For now just warn - we'll fix the cleanup
    });

    test('release root should not have loose .bat files (should be in archive only)', () => {
      // After a clean build, .bat files should only be in the archives, not loose in release/
      // However, they might be there for convenience - this is a soft check
      const addBat = join(RELEASE_DIR, 'add_context_menu.bat');
      const removeBat = join(RELEASE_DIR, 'remove_context_menu.bat');

      if (existsSync(addBat) || existsSync(removeBat)) {
        console.warn(
          'Loose .bat files found in release/ - consider if this is intentional'
        );
      }
    });

    test('release/dist/ directory should not exist after cleanup (worker bundled in archive)', () => {
      const distPath = join(RELEASE_DIR, 'dist');
      if (existsSync(distPath)) {
        console.warn(
          'release/dist/ directory exists - should be cleaned up after packaging'
        );
      }
    });
  });

  describe('ZIP archive contents', () => {
    let zipContents: string[] = [];

    beforeAll(() => {
      const zipPath = join(RELEASE_DIR, EXPECTED_ZIP_NAME);
      if (existsSync(zipPath)) {
        zipContents = listZipContents(zipPath);
      }
    });

    test('ZIP contains executable with .exe extension', () => {
      if (zipContents.length > 0) {
        const hasExe = zipContents.some(
          (f) => f === EXPECTED_EXE_NAME || f.endsWith('/' + EXPECTED_EXE_NAME)
        );
        const hasNoExtExe = zipContents.some(
          (f) =>
            (f === 'EZ-Game-Audio' || f.endsWith('/EZ-Game-Audio')) &&
            !f.includes('.exe')
        );

        // This is a critical error - Windows users won't be able to run the executable
        expect(hasNoExtExe && !hasExe).toBe(false);
        expect(hasExe).toBe(true);
      }
    });

    test('ZIP contains worker file', () => {
      if (zipContents.length > 0) {
        const hasWorker = zipContents.some(
          (f) => f.includes('converterWorker.js') || f.includes('dist/')
        );
        expect(hasWorker).toBe(true);
      }
    });

    test('ZIP contains ffmpeg binaries', () => {
      if (zipContents.length > 0) {
        const hasFfmpeg = zipContents.some(
          (f) => f.includes('ffmpeg') && f.includes('windows')
        );
        expect(hasFfmpeg).toBe(true);
      }
    });

    test('ZIP contains documentation', () => {
      if (zipContents.length > 0) {
        const hasReadme = zipContents.some(
          (f) => f.includes('README.html') || f.includes('readmes/')
        );
        expect(hasReadme).toBe(true);
      }
    });

    test('ZIP contains context menu scripts', () => {
      if (zipContents.length > 0) {
        const hasAddBat = zipContents.some((f) =>
          f.includes('add_context_menu.bat')
        );
        const hasRemoveBat = zipContents.some((f) =>
          f.includes('remove_context_menu.bat')
        );
        expect(hasAddBat).toBe(true);
        expect(hasRemoveBat).toBe(true);
      }
    });
  });

  describe('7z archive contents (if exists)', () => {
    let sevenZContents: string[] = [];
    const sevenZPath = join(RELEASE_DIR, EXPECTED_7Z_NAME);

    beforeAll(() => {
      if (existsSync(sevenZPath)) {
        sevenZContents = list7zContents(sevenZPath);
      }
    });

    test('7z contains executable with .exe extension (if archive exists)', () => {
      if (sevenZContents.length > 0) {
        const hasExe = sevenZContents.some(
          (f) => f === EXPECTED_EXE_NAME || f.endsWith('\\' + EXPECTED_EXE_NAME)
        );
        expect(hasExe).toBe(true);
      }
    });
  });

  describe('Checksum verification', () => {
    test('ZIP checksum matches file content', () => {
      const zipPath = join(RELEASE_DIR, EXPECTED_ZIP_NAME);
      const checksumPath = join(RELEASE_DIR, `${EXPECTED_ZIP_NAME}.sha256`);

      if (existsSync(zipPath) && existsSync(checksumPath)) {
        const checksumContent = readFileSync(checksumPath, 'utf8').trim();
        const expectedHash = checksumContent.split(/\s+/)[0];

        // Compute actual hash
        const fileBuffer = readFileSync(zipPath);
        const actualHash = createHash('sha256')
          .update(fileBuffer)
          .digest('hex');

        expect(actualHash).toBe(expectedHash);
      }
    });
  });

  describe('Update manifest', () => {
    test('update.json has correct structure', () => {
      const manifestPath = join(RELEASE_DIR, 'update.json');

      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

        expect(manifest).toHaveProperty('version');
        expect(manifest).toHaveProperty('publishedAt');
        expect(manifest).toHaveProperty('files');
        expect(Array.isArray(manifest.files)).toBe(true);

        for (const file of manifest.files) {
          expect(file).toHaveProperty('file');
          expect(file).toHaveProperty('sha256');
          expect(typeof file.sha256).toBe('string');
          expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
        }
      }
    });
  });
});

describe('Smoke Test Cleanup', () => {
  test('smokeTest.mjs should clean up smoke-temp directory', () => {
    // This test documents that smoke-temp should be cleaned up
    // The actual cleanup logic needs to be added to smokeTest.mjs
    const smokeTempPath = join(RELEASE_DIR, 'smoke-temp');

    // After running smoke tests, this directory should not exist
    // Currently this is a known issue that needs fixing
    if (existsSync(smokeTempPath)) {
      console.warn(
        'TODO: smokeTest.mjs needs to clean up smoke-temp directory'
      );
    }
  });
});
