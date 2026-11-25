// outputChecks.ts
// Sanity checks on a finished ffmpeg output.
import * as fs from 'fs';

/**
 * True when a FLAC file's STREAMINFO says it holds no samples. ffmpeg's FLAC
 * encoder exits 0 for an input with no audio (`-abort_on
 * empty_output_stream` doesn't catch it), leaving a header-only file.
 * Returns false when the file can't be read or isn't FLAC.
 */
export const isEmptyFlac = (filePath: string): boolean => {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const head = Buffer.alloc(26);
    if (fs.readSync(fd, head, 0, 26, 0) < 26) return false;
    // "fLaC", then the first metadata block, which must be STREAMINFO (type 0).
    if (head.toString('ascii', 0, 4) !== 'fLaC' || (head[4]! & 0x7f) !== 0) {
      return false;
    }
    // Total samples: 36 bits starting at the low nibble of byte 21.
    const totalSamples = (head[21]! & 0x0f) * 2 ** 32 + head.readUInt32BE(22);
    return totalSamples === 0;
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
