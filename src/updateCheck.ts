import { spawn } from 'child_process';
import chalk from 'chalk';
import { APP_VERSION } from './version.js';
import { getAnswer } from './utils.js';
import logger from './logger.js';

const LATEST_RELEASE_API =
  'https://api.github.com/repos/SpaceFoon/Ez-Game-Audio-Conversion/releases/latest';

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
}

const normalizeVersion = (value: string): number[] =>
  value
    .trim()
    .replace(/^v/i, '')
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));

export const isNewerVersion = (latest: string, current: string): boolean => {
  const a = normalizeVersion(latest);
  const b = normalizeVersion(current);

  for (let i = 0; i < 3; i += 1) {
    const latestPart = a[i] ?? 0;
    const currentPart = b[i] ?? 0;
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
};

const openUrl = (url: string): void => {
  const command =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];

  const child = spawn(command[0], command[1], {
    detached: true,
    stdio: 'ignore',
    shell: false,
  });
  child.unref();
};

export const checkForUpdates = async (): Promise<void> => {
  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `EZ-Game-Audio/${APP_VERSION}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return;

    const release = (await response.json()) as GitHubRelease;
    if (release.draft || release.prerelease) return;

    const latestVersion = release.tag_name?.trim();
    const releaseUrl = release.html_url?.trim();
    if (!latestVersion || !releaseUrl) return;
    if (!isNewerVersion(latestVersion, APP_VERSION)) return;

    logger.log(
      chalk.yellowBright(
        `\n⬆ Update available: EZ Game Audio ${latestVersion.replace(/^v/i, '')} (current ${APP_VERSION})`
      )
    );
    const answer = await getAnswer('Open the GitHub release page to update? [Y/n] ');

    if (answer.trim().toLowerCase() === '' || answer.trim().toLowerCase() === 'y') {
      openUrl(releaseUrl);
    }
  } catch {
    // Update checks must never delay or block normal app startup.
  }
};
