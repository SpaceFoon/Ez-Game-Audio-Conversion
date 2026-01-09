import os from 'os';
import 'dotenv/config';

interface EnvConfig {
  isDev: boolean;
  isDebug: boolean;
  isPkg: boolean;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  arch: string;
  platform: string;
  cpuCount: number;
}

declare global {
  var env: EnvConfig;
}

const hasNodeSeaFuse = Object.keys(process.env).some((key) =>
  key.startsWith('NODE_SEA_FUSE_')
);
const isSeaBundle = process.env.NODE_SEA_BUILD === 'true' || hasNodeSeaFuse;
const isPkgEnv =
  Boolean(process.env.PKG_ENV && process.env.PKG_ENV !== 'dev') || isSeaBundle;

if (typeof globalThis.env === 'undefined') {
  globalThis.env = {
    isDev: process.env.NODE_ENV === 'dev',
    isDebug: process.env.DEBUG === 'true',
    isPkg:
      Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg) || isPkgEnv,

    // OS info
    isWindows: os.platform() === 'win32',
    isMac: os.platform() === 'darwin',
    isLinux: os.platform() === 'linux',
    arch: os.arch(), // e.g. 'x64'
    platform: os.platform(), // e.g. 'win32'
    cpuCount: os.cpus().length,
  };
}
