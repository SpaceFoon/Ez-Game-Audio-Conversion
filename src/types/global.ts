export interface GlobalEnv {
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
  // Allow direct global variable access: env

  var env: GlobalEnv;

  // Make globalThis.env type-safe in Node
  interface GlobalThis {
    env: GlobalEnv;
  }
}
