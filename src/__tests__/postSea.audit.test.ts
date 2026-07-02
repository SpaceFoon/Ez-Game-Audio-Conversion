import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { join } from 'path';

let unixExeRenamed = false;
const copiedSources: string[] = [];

const rootDir = process.cwd();
const releaseDir = join(rootDir, 'release');
const packageDir = join(releaseDir, 'package');
const readmesDir = join(packageDir, 'readmes');

// Characterization tests for host-platform packaging behavior.
// On Linux, a plain EZ-Game-Audio binary remains extensionless and the Linux
// FFmpeg bundle is staged.

jest.unstable_mockModule('os', () => ({
  platform: jest.fn(() => 'linux'),
}));

jest.unstable_mockModule('child_process', () => ({
  execSync: jest.fn(() => ''),
}));

jest.unstable_mockModule('fs', () => ({
  copyFileSync: jest.fn((source: string) => {
    copiedSources.push(String(source));
  }),
  existsSync: jest.fn((target: string) => {
    const normalized = String(target).replace(/\\/g, '/');
    if (normalized === `${releaseDir.replace(/\\/g, '/')}/EZ-Game-Audio.exe`) {
      return unixExeRenamed;
    }
    if (normalized === `${releaseDir.replace(/\\/g, '/')}/EZ-Game-Audio`) {
      return true;
    }
    if (normalized === `${rootDir.replace(/\\/g, '/')}/package.json`) {
      return true;
    }
    if (normalized === `${readmesDir.replace(/\\/g, '/')}/README.html`) {
      return true;
    }
    if (normalized.endsWith('/ffmpeg-bin')) {
      return true;
    }
    if (normalized.endsWith('/ffmpeg-bin/README.md')) {
      return true;
    }
    if (normalized.endsWith('/ffmpeg-bin/linux')) {
      return true;
    }
    if (normalized.endsWith('/release/dist')) {
      return true;
    }
    if (normalized.endsWith('/docs/readmes')) {
      return true;
    }
    if (normalized.endsWith('/src/windows-functions/add_context_menu.bat')) {
      return true;
    }
    if (normalized.endsWith('/src/windows-functions/remove_context_menu.bat')) {
      return true;
    }
    return false;
  }),
  linkSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(
    (target: string, options?: { withFileTypes?: boolean }) => {
      const normalized = String(target).replace(/\\/g, '/');
      const makeFile = (name: string) => ({
        name,
        isDirectory: () => false,
        isFile: () => true,
      });

      if (normalized.endsWith('/ffmpeg-bin/linux')) {
        return options?.withFileTypes
          ? [makeFile('ffmpeg'), makeFile('ffprobe')]
          : ['ffmpeg', 'ffprobe'];
      }
      if (normalized.endsWith('/release/dist')) {
        return options?.withFileTypes
          ? [makeFile('converterWorker.js')]
          : ['converterWorker.js'];
      }
      if (normalized.endsWith('/docs/readmes')) {
        return options?.withFileTypes
          ? [makeFile('How-to-start.txt')]
          : ['How-to-start.txt'];
      }
      if (normalized.endsWith('/release')) {
        return options?.withFileTypes ? [] : ['EZ-Game-Audio'];
      }
      return [];
    }
  ),
  renameSync: jest.fn(() => {
    unixExeRenamed = true;
  }),
  rmSync: jest.fn(),
  readFileSync: jest.fn((target: string) => {
    const normalized = String(target).replace(/\\/g, '/');
    if (normalized.endsWith('/package.json')) {
      return JSON.stringify({ version: '1.7.1' });
    }
    if (normalized.endsWith('/README.md')) {
      return '# README';
    }
    return 'file';
  }),
  writeFileSync: jest.fn(),
}));

describe('post-sea audit characterization', () => {
  const originalCI = process.env.CI;
  const originalGithubActions = process.env.GITHUB_ACTIONS;

  beforeEach(() => {
    jest.resetModules();
    unixExeRenamed = false;
    copiedSources.length = 0;
    process.env.CI = 'false';
    process.env.GITHUB_ACTIONS = 'false';
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    process.env.CI = originalCI;
    process.env.GITHUB_ACTIONS = originalGithubActions;
  });

  it('keeps a linux-host executable extensionless and stages linux ffmpeg', async () => {
    await import('../../scripts/post-sea.js');

    expect(unixExeRenamed).toBe(false);
    expect(
      copiedSources.some((source) =>
        String(source).replace(/\\/g, '/').endsWith('/ffmpeg-bin/linux/ffmpeg')
      )
    ).toBe(true);
    expect(
      copiedSources.some((source) =>
        String(source).replace(/\\/g, '/').endsWith('/ffmpeg-bin/linux/ffprobe')
      )
    ).toBe(true);
  });

  it('proves non-windows packaging still copies windows helper scripts into the stage root', async () => {
    await import('../../scripts/post-sea.js');

    expect(
      copiedSources.some((source) =>
        String(source)
          .replace(/\\/g, '/')
          .endsWith('/src/windows-functions/add_context_menu.bat')
      )
    ).toBe(true);
    expect(
      copiedSources.some((source) =>
        String(source)
          .replace(/\\/g, '/')
          .endsWith('/src/windows-functions/remove_context_menu.bat')
      )
    ).toBe(true);
  });
});
