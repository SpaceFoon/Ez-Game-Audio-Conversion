/**
 * Shared helpers for integration / E2E tests that need bundled ffmpeg and
 * compiled worker threads.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';
import { findBinary } from '../../utils.js';

const PLATFORM_SLUG =
  platform() === 'win32'
    ? 'windows'
    : platform() === 'darwin'
      ? 'macos'
      : 'linux';
const FFMPEG_EXE = platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const FFPROBE_EXE = platform() === 'win32' ? 'ffprobe.exe' : 'ffprobe';

export const ffmpegPath = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  FFMPEG_EXE
);
export const ffprobePath = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  FFPROBE_EXE
);

export const ffmpegAvailable =
  existsSync(ffmpegPath) && existsSync(ffprobePath);
export const workerAvailable =
  findBinary('converterWorker.js', ['dist']) !== null;
export const canRunIntegration = ffmpegAvailable && workerAvailable;

export const integrationSkipReason = !ffmpegAvailable
  ? `ffmpeg not found at ${ffmpegPath}`
  : !workerAvailable
    ? 'dist/converterWorker.js missing — run npm run build'
    : '';

export const e2eRequired = process.env.E2E_REQUIRED === '1';

export const requireIntegrationDeps = (): void => {
  if (!canRunIntegration) {
    throw new Error(
      e2eRequired
        ? `E2E_REQUIRED=1: ${integrationSkipReason}`
        : integrationSkipReason
    );
  }
};
