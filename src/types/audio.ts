export type AudioFormat = 'flac' | 'aiff' | 'wav' | 'mp3' | 'm4a' | 'ogg';

export type OggCodec = 'vorbis' | 'opus' | null;

export interface AudioFile {
  inputFile: string;
  outputFile: string;
  inputFormat: AudioFormat;
  outputFormat: AudioFormat;
}

export interface ConversionItem {
  inputFile: string;
  outputFile: string;
  outputFormat?: AudioFormat;
}

export interface ConversionResult {
  success: boolean;
  inputFile: string;
  outputFile: string;
  error?: string;
}

export interface ConversionJob {
  failedFiles: ConversionResult[];
  successfulFiles: ConversionResult[];
  jobStartTime: Date;
}
