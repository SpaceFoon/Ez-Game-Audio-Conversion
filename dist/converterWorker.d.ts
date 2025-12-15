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
export { runConversion, converterWorker };
//# sourceMappingURL=converterWorker.d.ts.map