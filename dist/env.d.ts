import "dotenv/config";
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
export {};
//# sourceMappingURL=env.d.ts.map