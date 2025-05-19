const os = require("os");
require("dotenv").config();

if (typeof globalThis.env === "undefined") {
  globalThis.env = {
    isDev: process.env.NODE_ENV === "dev",
    isDebug: process.env.DEBUG === "true",
    isPkg: process.env.PKG_ENV === "",

    // OS info
    isWindows: os.platform() === "win32",
    isMac: os.platform() === "darwin",
    isLinux: os.platform() === "linux",
    arch: os.arch(), // e.g. 'x64'
    platform: os.platform(), // e.g. 'win32'
    cpuCount: os.cpus().length,
  };
}
