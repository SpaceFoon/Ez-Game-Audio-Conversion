import type { Settings, LogEntry, FileInfo } from './types/settings.js';
export declare const isSeaRuntime: boolean;
export declare const isPackagedRuntime: boolean;
export declare const runtimeBaseDir: string;
export declare const platformSlug: string;
export declare let settings: Settings;
type ReadLineLike = {
    question: (q: string, cb: (answer: string) => void) => void;
    close: () => void;
};
declare let rl: ReadLineLike;
export declare const getAnswer: (question: string | string[]) => Promise<string>;
export declare const checkDiskSpace: (directory?: string) => boolean;
export declare const isFileBusy: (file: string) => Promise<boolean>;
export declare const __setLogFileStateForTests: (logPath?: string | null, errorPath?: string | null) => void;
export declare const __getLogFileStateForTests: () => {
    logFile: string | null;
    errorFile: string | null;
};
export declare const initializeFileNames: () => void;
export declare const addToLog: (log: LogEntry, file?: FileInfo) => Promise<boolean | void>;
export declare function handleExit(code?: number, { restart }?: {
    restart?: boolean;
}): void;
export { rl };
//# sourceMappingURL=utils.d.ts.map