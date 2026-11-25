export interface AudioStream {
  index: number;
  codec_name: string;
  codec_type: string;
  sample_rate: string;
  channels: number;
  /** Source bit depth (FLAC, PCM); absent for lossy codecs. */
  bits_per_raw_sample?: string | number;
  bits_per_sample?: string | number;
  duration?: string;
  bit_rate?: string;
  tags?: {
    [key: string]: string;
  };
}

export interface FfprobeFormat {
  filename: string;
  format_name: string;
  duration: string;
  size: string;
  bit_rate: string;
  tags?: {
    [key: string]: string;
  };
}

export interface AudioMetadata {
  streams: AudioStream[];
  format: FfprobeFormat;
}

export interface LoopPoint {
  start: number;
  end: number;
}
