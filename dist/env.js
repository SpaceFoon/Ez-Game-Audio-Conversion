import os from 'os';
import 'dotenv/config';
const hasNodeSeaFuse = Object.keys(process.env).some((key) => key.startsWith('NODE_SEA_FUSE_'));
const isSeaBundle = process.env.NODE_SEA_BUILD === 'true' || hasNodeSeaFuse;
const isPkgEnv = Boolean(process.env.PKG_ENV && process.env.PKG_ENV !== 'dev') || isSeaBundle;
if (typeof globalThis.env === 'undefined') {
    globalThis.env = {
        isDev: process.env.NODE_ENV === 'dev',
        isDebug: process.env.DEBUG === 'true',
        isPkg: Boolean(process.pkg) || isPkgEnv,
        // OS info
        isWindows: os.platform() === 'win32',
        isMac: os.platform() === 'darwin',
        isLinux: os.platform() === 'linux',
        arch: os.arch(), // e.g. 'x64'
        platform: os.platform(), // e.g. 'win32'
        cpuCount: os.cpus().length,
    };
}
//# sourceMappingURL=env.js.map