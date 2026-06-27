export type AudioFormat = 'flac' | 'aiff' | 'wav' | 'mp3' | 'm4a' | 'ogg';

export type InputAudioFormat = AudioFormat;

export type OggCodec = 'vorbis' | 'opus' | null;

export interface AudioFile {
  inputFile: string;
  outputFile: string;
  inputFormat: InputAudioFormat;
  outputFormat: AudioFormat;
}

export interface ConversionItem {
  inputFile: string;
  outputFile: string;
  outputFormat: AudioFormat;
}

export type ConversionAction = 'convert' | 'skip';

export interface ConversionCandidate extends ConversionItem {
  action: ConversionAction;
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
