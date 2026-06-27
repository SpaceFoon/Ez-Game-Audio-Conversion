import { describe, it, expect } from '@jest/globals';
import { existsSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';
import { findBinary } from '../utils.js';

const PLATFORM_SLUG =
  platform() === 'win32'
    ? 'windows'
    : platform() === 'darwin'
      ? 'macos'
      : 'linux';
const FFMPEG_EXE = platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const FFMPEG_PATH = join(
  process.cwd(),
  'ffmpeg-bin',
  PLATFORM_SLUG,
  FFMPEG_EXE
);

describe('CI integration guard', () => {
  it('requires ffmpeg binaries when running in CI', () => {
    if (process.env.CI !== 'true') {
      return;
    }

    expect(existsSync(FFMPEG_PATH)).toBe(true);
  });

  it('requires compiled worker when running in CI', () => {
    if (process.env.CI !== 'true') {
      return;
    }

    expect(findBinary('converterWorker.js', ['dist'])).not.toBeNull();
  });
});
