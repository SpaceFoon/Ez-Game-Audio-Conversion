import type { AudioMetadata } from './types/metadata';
export declare const formatMetaDataArgs: (metaData: AudioMetadata | null, inputFile?: string) => {
    metaDataArgs: string[];
    channelsArgs: string[];
};
export declare const getLoopPoints: (metaData: any) => {
    loopStart: number;
    loopLength: number;
};
export declare const convertLoopPoints: (metaData: any, outputFormat: string, oggCodec: string) => {
    newSampleRate: number | null;
    loopStart: number;
    loopLength: number;
};
export declare const formatLoopData: (loopStart: any, loopLength: any) => string;
//# sourceMappingURL=metadataService.d.ts.map