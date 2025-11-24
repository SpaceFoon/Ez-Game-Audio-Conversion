import type { AudioMetadata } from './types/metadata.js';
declare const getMetaData: (inputFile: string) => Promise<AudioMetadata | null>;
declare const formatMetaDataField: (streamTags: Record<string, string> | undefined, formatTags: Record<string, string> | undefined, field: string) => string;
declare const formatMetaData: (metaData: AudioMetadata | null, inputFile?: string) => {
    metaData: string;
    channels: string;
};
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
export { getMetaData, formatMetaDataField, formatMetaData, };
//# sourceMappingURL=metadataService.d.ts.map