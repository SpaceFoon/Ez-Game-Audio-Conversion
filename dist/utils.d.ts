import type { Settings, LogEntry, FileInfo } from './types/settings.js';
export declare let settings: Settings;
type ReadLineLike = {
    question: (q: string, cb: (answer: string) => void) => void;
    close: () => void;
};
declare let rl: ReadLineLike;
export declare const getAnswer: (question: string | string[]) => Promise<string>;
export declare const checkDiskSpace: (directory?: string) => boolean;
export declare const isFileBusy: (file: string) => Promise<boolean>;
export declare const initializeFileNames: () => void;
export declare const addToLog: (log: LogEntry, file?: FileInfo) => Promise<boolean | void>;
export declare function handleExit(code?: number, { restart }?: {
    restart?: boolean;
}): void;
export { rl };
//# sourceMappingURL=utils.d.ts.map