#!/usr/bin/env node

import { execFileSync } from 'child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  chmodSync,
  copyFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const skipDownload = process.env.EZ_AUDIO_SKIP_FFMPEG_DOWNLOAD === '1';
const forceDownload = process.env.EZ_AUDIO_FORCE_FFMPEG_DOWNLOAD === '1';

const platformSlug =
  process.platform === 'win32'
    ? 'windows'
    : process.platform === 'darwin'
      ? 'macos'
      : process.platform === 'linux'
        ? 'linux'
        : null;

const platformConfig = {
  windows: {
    files: ['ffmpeg.exe', 'ffprobe.exe'],
    downloads: [
      {
        url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
        archiveName: 'ffmpeg-windows.zip',
      },
    ],
    extract: extractZip,
  },
  linux: {
    files: ['ffmpeg', 'ffprobe'],
    downloads: [
      {
        url:
          process.arch === 'arm64'
            ? 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz'
            : 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
        archiveName: 'ffmpeg-linux.tar.xz',
      },
    ],
    extract: extractTarXz,
  },
  macos: {
    files: ['ffmpeg', 'ffprobe'],
    downloads: [
      {
        url: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
        archiveName: 'ffmpeg-macos.zip',
      },
      {
        url: 'https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip',
        archiveName: 'ffprobe-macos.zip',
      },
    ],
    extract: extractZip,
  },
};

const log = (message) => console.log(`[install-ffmpeg] ${message}`);

if (skipDownload) {
  log('Skipping FFmpeg download (EZ_AUDIO_SKIP_FFMPEG_DOWNLOAD=1).');
  process.exit(0);
}

if (!platformSlug || !platformConfig[platformSlug]) {
  log(`Unsupported platform: ${process.platform}. Skipping FFmpeg download.`);
  process.exit(0);
}

const config = platformConfig[platformSlug];
const destinationDir = join(rootDir, 'ffmpeg-bin', platformSlug);
const tempDir = join(rootDir, '.ffmpeg-download');

const hasAllBinaries = () =>
  config.files.every((fileName) => existsSync(join(destinationDir, fileName)));

if (!forceDownload && hasAllBinaries()) {
  log(`FFmpeg binaries already exist in ffmpeg-bin/${platformSlug}.`);
  process.exit(0);
}

try {
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
  mkdirSync(destinationDir, { recursive: true });

  for (const download of config.downloads) {
    const archivePath = join(tempDir, download.archiveName);
    log(`Downloading ${download.url}`);
    await downloadFile(download.url, archivePath);

    const extractDir = join(
      tempDir,
      download.archiveName.replace(/[^a-z0-9]/gi, '-')
    );
    mkdirSync(extractDir, { recursive: true });
    config.extract(archivePath, extractDir);
    copyBinaries(extractDir, destinationDir, config.files);
  }

  if (!hasAllBinaries()) {
    throw new Error(
      `Download completed, but expected binaries were not found in ffmpeg-bin/${platformSlug}: ${config.files.join(', ')}`
    );
  }

  if (platformSlug !== 'windows') {
    for (const fileName of config.files) {
      chmodSync(join(destinationDir, fileName), 0o755);
    }
  }

  log(`Installed ${config.files.join(' and ')} to ffmpeg-bin/${platformSlug}.`);
} catch (error) {
  console.error(
    '[install-ffmpeg] Failed to install FFmpeg binaries:',
    error instanceof Error ? error.message : String(error)
  );
  console.error(
    '[install-ffmpeg] You can still install manually using ffmpeg-bin/README.md, or set EZ_AUDIO_SKIP_FFMPEG_DOWNLOAD=1 to skip this step.'
  );
  process.exit(1);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl, redirectCount = 0) => {
      const client = currentUrl.startsWith('https:') ? https : http;
      const req = client.get(currentUrl, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          if (redirectCount > 5) {
            reject(new Error(`Too many redirects for ${url}`));
            response.resume();
            return;
          }
          const redirectedUrl = new URL(
            response.headers.location,
            currentUrl
          ).toString();
          response.resume();
          request(redirectedUrl, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(
              `HTTP ${response.statusCode} while downloading ${currentUrl}`
            )
          );
          response.resume();
          return;
        }

        const file = createWriteStream(destination);
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      });
      req.on('error', reject);
    };

    request(url);
  });
}

function extractZip(archivePath, extractDir) {
  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replaceAll("'", "''")}' -DestinationPath '${extractDir.replaceAll("'", "''")}' -Force`,
      ],
      { stdio: 'inherit' }
    );
    return;
  }

  execFileSync('unzip', ['-q', archivePath, '-d', extractDir], {
    stdio: 'inherit',
  });
}

function extractTarXz(archivePath, extractDir) {
  execFileSync('tar', ['-xJf', archivePath, '-C', extractDir], {
    stdio: 'inherit',
  });
}

function copyBinaries(searchRoot, destinationDir, fileNames) {
  const found = new Map();
  findFiles(searchRoot, fileNames, found);

  for (const [fileName, sourcePath] of found) {
    copyFileSync(sourcePath, join(destinationDir, fileName));
  }
}

function findFiles(directory, wantedNames, found) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      findFiles(entryPath, wantedNames, found);
      continue;
    }
    if (wantedNames.includes(entry.name) && !found.has(entry.name)) {
      found.set(entry.name, entryPath);
    }
  }
}
