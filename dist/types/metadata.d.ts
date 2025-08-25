export interface AudioStream {
    index: number;
    codec_name: string;
    codec_type: string;
    sample_rate: string;
    channels: number;
    duration?: string;
    bit_rate?: string;
    tags?: {
        [key: string]: string;
    };
}
export interface AudioFormat {
    filename: string;
    duration: string;
    size: string;
    bit_rate: string;
    tags?: {
        [key: string]: string;
    };
}
export interface AudioMetadata {
    streams: AudioStream[];
    format: AudioFormat;
}
export interface LoopPoint {
    start: number;
    end: number;
}
//# sourceMappingURL=metadata.d.ts.map