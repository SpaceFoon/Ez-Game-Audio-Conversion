import type { AudioFormat, OggCodec } from "./audio";

export interface Settings {
  inputFilePath: string;
  outputFilePath: string;
  inputFormats: AudioFormat[];
  outputFormats: AudioFormat[];
  oggCodec: OggCodec;
  singleFileMode: boolean;
  singleFilePath: string;
  userOS: string | null;
}

export interface LogEntry {
  type: 'error' | 'stderr' | 'stdout' | 'info';
  data: string | Buffer | unknown;
}

export interface FileInfo {
  inputFile?: string;
  outputFile?: string;
}