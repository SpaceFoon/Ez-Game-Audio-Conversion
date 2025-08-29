declare const spawn: any;
declare const workerData: any, parentPort: any;
declare const join: any, dirname: any;
declare const existsSync: any, mkdirSync: any;
declare const getMetaData: any, formatMetaDataArgs: any, convertLoopPoints: any, formatLoopData: any, formatMetaData: any;
declare const failWorker: (reason: any) => never;
declare const postError: (reason: any, fileCtx?: any) => void;
declare function ensureDirectoryExists(filePath: string): void;
declare const converterWorker: ({ file: { inputFile, outputFile, outputFormat }, settings: { oggCodec }, }: {
    file: {
        inputFile: string;
        outputFile: string;
        outputFormat: string;
    };
    settings: {
        oggCodec: string;
    };
}) => Promise<void>;
declare const runConversion: () => Promise<void>;
declare const runFFMPEG: (ffmpegPath: string, ffmpegArgs: string[], outputFile: string, inputFile: string) => Promise<void>;
//# sourceMappingURL=converterWorker.d.ts.map