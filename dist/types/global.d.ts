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
    var env: GlobalEnv;
    interface GlobalThis {
        env: GlobalEnv;
    }
}
//# sourceMappingURL=global.d.ts.map