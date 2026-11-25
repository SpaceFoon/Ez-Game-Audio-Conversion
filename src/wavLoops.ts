// wavLoops.ts
// Reads the loop from a WAV file's RIFF "smpl" chunk — where most audio
// tools and game engines store WAV loop points. ffprobe does not expose it.
import * as fs from 'fs';

/**
 * Append a one-loop smpl chunk to a WAV file. `loopLength` NaN loops from
 * `loopStart` to the end. Returns false (file left untouched) when the file
 * isn't a plain RIFF/WAVE with fmt and data chunks.
 */
export const writeWavSmplLoop = (
  filePath: string,
  loopStart: number,
  loopLength: number
): boolean => {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r+');
    let size = fs.fstatSync(fd).size;
    const header = Buffer.alloc(12);
    if (fs.readSync(fd, header, 0, 12, 0) < 12) return false;
    // RF64 (over 4 GB) keeps its sizes elsewhere; leave it alone.
    if (
      header.toString('ascii', 0, 4) !== 'RIFF' ||
      header.toString('ascii', 8, 12) !== 'WAVE'
    ) {
      return false;
    }

    let sampleRate = 0;
    let blockAlign = 0;
    let dataBytes = -1;
    let offset = 12;
    const chunkHeader = Buffer.alloc(8);
    while (offset + 8 <= size) {
      if (fs.readSync(fd, chunkHeader, 0, 8, offset) < 8) break;
      const id = chunkHeader.toString('ascii', 0, 4);
      const length = chunkHeader.readUInt32LE(4);
      if (id === 'smpl') return false; // already has loop data
      if (id === 'fmt ' && length >= 16) {
        const fmt = Buffer.alloc(16);
        fs.readSync(fd, fmt, 0, 16, offset + 8);
        sampleRate = fmt.readUInt32LE(4);
        blockAlign = fmt.readUInt16LE(12);
      } else if (id === 'data') {
        dataBytes = Math.min(length, size - offset - 8);
      }
      offset += 8 + length + (length % 2);
    }
    if (!sampleRate || !blockAlign || dataBytes < 0) return false;

    const totalFrames = Math.floor(dataBytes / blockAlign);
    const start = Math.max(0, Math.round(loopStart));
    const end = Number.isFinite(loopLength)
      ? start + Math.round(loopLength) - 1
      : totalFrames - 1;
    if (end < start) return false;

    const smpl = Buffer.alloc(8 + 36 + 24);
    smpl.write('smpl', 0, 'ascii');
    smpl.writeUInt32LE(36 + 24, 4);
    smpl.writeUInt32LE(Math.round(1e9 / sampleRate), 8 + 8); // sample period (ns)
    smpl.writeUInt32LE(60, 8 + 12); // MIDI unity note: middle C
    smpl.writeUInt32LE(1, 8 + 28); // one loop
    smpl.writeUInt32LE(0, 8 + 36 + 4); // forward loop
    smpl.writeUInt32LE(start, 8 + 36 + 8);
    smpl.writeUInt32LE(end, 8 + 36 + 12); // inclusive end sample
    // play count 0 = loop forever

    // The RIFF size field is 32-bit.
    if (size + 1 + smpl.length - 8 > 0xffffffff) return false;

    // Chunks start on even offsets.
    if (size % 2) {
      fs.writeSync(fd, Buffer.alloc(1), 0, 1, size);
      size += 1;
    }
    fs.writeSync(fd, smpl, 0, smpl.length, size);
    const riffSize = Buffer.alloc(4);
    riffSize.writeUInt32LE(size + smpl.length - 8);
    fs.writeSync(fd, riffSize, 0, 4, 4);
    return true;
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

/** First loop in the file's smpl chunk, as LOOPSTART/LOOPLENGTH sample counts. */
export const readWavSmplLoop = (
  filePath: string
): { loopStart: number; loopLength: number } | null => {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const size = fs.fstatSync(fd).size;
    const header = Buffer.alloc(12);
    if (fs.readSync(fd, header, 0, 12, 0) < 12) return null;
    const riff = header.toString('ascii', 0, 4);
    if (
      (riff !== 'RIFF' && riff !== 'RF64') ||
      header.toString('ascii', 8, 12) !== 'WAVE'
    ) {
      return null;
    }

    // Walk the chunk list; the smpl chunk usually sits after the audio data.
    let offset = 12;
    const chunkHeader = Buffer.alloc(8);
    while (offset + 8 <= size) {
      if (fs.readSync(fd, chunkHeader, 0, 8, offset) < 8) return null;
      const id = chunkHeader.toString('ascii', 0, 4);
      const length = chunkHeader.readUInt32LE(4);
      if (id === 'smpl') {
        if (length < 36) return null;
        const body = Buffer.alloc(Math.min(length, 36 + 24));
        fs.readSync(fd, body, 0, body.length, offset + 8);
        const loopCount = body.readUInt32LE(28);
        if (loopCount < 1 || body.length < 60) return null;
        const start = body.readUInt32LE(36 + 8);
        const end = body.readUInt32LE(36 + 12); // inclusive end sample
        if (end < start) return null;
        return { loopStart: start, loopLength: end - start + 1 };
      }
      // Chunks are padded to an even length.
      offset += 8 + length + (length % 2);
    }
    return null;
  } catch {
    return null;
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
