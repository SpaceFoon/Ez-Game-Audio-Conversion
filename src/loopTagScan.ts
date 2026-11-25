// loopTagScan.ts
// Quick check, before converting, of whether any input file carries loop
// points, so the app only asks how to handle loop tags when there are some.
// It reads raw bytes instead of running ffprobe, so it stays fast on large
// batches. A miss just means the question isn't asked and the default
// ("keep loop tags where the format supports them") applies.
import * as fs from 'fs';
import { readWavSmplLoop } from './wavLoops.js';

/** LOOPSTART / LOOP_LENGTH / LoopEnd / iTunes "itunesloopstart" etc. */
const LOOP_TAG_PATTERN = /loop[ _-]?(start|length|end)/i;

// Tags live near the start of OGG, FLAC and MP3 files, and in either the
// header or the trailer of WAV, AIFF and M4A files.
const HEAD_BYTES = 256 * 1024;
const TAIL_BYTES = 64 * 1024;

export interface LoopScanOptions {
  /** Stop after this many files without a hit. */
  maxFiles?: number;
  /** Stop after this many milliseconds without a hit. */
  timeBudgetMs?: number;
}

const readRange = (fd: number, position: number, length: number): string => {
  const buffer = Buffer.alloc(length);
  const read = fs.readSync(fd, buffer, 0, length, position);
  return buffer.toString('latin1', 0, read);
};

/** True when the file's header or trailer mentions a loop tag. */
export const fileHasLoopTags = (filePath: string): boolean => {
  if (/\.wav$/i.test(filePath) && readWavSmplLoop(filePath)) return true;

  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const size = fs.fstatSync(fd).size;
    if (LOOP_TAG_PATTERN.test(readRange(fd, 0, Math.min(size, HEAD_BYTES)))) {
      return true;
    }
    if (size > HEAD_BYTES) {
      const length = Math.min(TAIL_BYTES, size - HEAD_BYTES);
      return LOOP_TAG_PATTERN.test(readRange(fd, size - length, length));
    }
    return false;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    }
  }
};

/** First input file that has loop tags, or null if none was found in budget. */
export const findLoopTaggedFile = (
  files: Iterable<string>,
  { maxFiles = 5000, timeBudgetMs = 3000 }: LoopScanOptions = {}
): string | null => {
  const deadline = Date.now() + timeBudgetMs;
  let checked = 0;
  for (const file of files) {
    if (checked >= maxFiles || Date.now() > deadline) break;
    checked++;
    if (fileHasLoopTags(file)) return file;
  }
  return null;
};
