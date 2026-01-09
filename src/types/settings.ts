import type { AudioFormat, InputAudioFormat, OggCodec } from './audio.js';

export type LoopDataMode = 'auto' | 'skip' | 'force';

export interface Settings {
  inputFilePath: string;
  outputFilePath: string;
  inputFormats: InputAudioFormat[];
  outputFormats: AudioFormat[];
  oggCodec: OggCodec;
  loopDataMode?: LoopDataMode;
  singleFileMode: boolean;
  singleFilePath: string;
  userOS: string | null;
}

export interface LogEntry {
  type: 'error' | 'stderr' | 'stdout' | 'info' | 'code';
  data: string | Buffer | number | unknown;
}

export interface FileInfo {
  inputFile?: string;
  outputFile?: string;
}
