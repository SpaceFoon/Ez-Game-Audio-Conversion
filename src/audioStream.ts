// audioStream.ts
import type { AudioMetadata, AudioStream } from './types/metadata.js';

/**
 * The stream to take sample rate, channels and stream tags from: the first
 * audio stream. ffprobe can list cover art or other streams first.
 */
export const getAudioStream = (
  metaData: AudioMetadata | null | undefined
): AudioStream | undefined =>
  metaData?.streams?.find((s) => s?.codec_type === 'audio') ??
  // Older callers/tests may omit codec_type; fall back to the first stream
  // only when no stream declares a type at all.
  (metaData?.streams?.every((s) => !s?.codec_type)
    ? metaData?.streams?.[0]
    : undefined);
