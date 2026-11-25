/** WAV loops stored in the RIFF smpl chunk (B32). */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readWavSmplLoop, writeWavSmplLoop } from '../wavLoops.js';

const wav = (extraChunks: Buffer[] = []): Buffer => {
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0);
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8); // PCM
  fmt.writeUInt16LE(1, 10); // mono
  fmt.writeUInt32LE(44100, 12);
  fmt.writeUInt32LE(88200, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const data = Buffer.alloc(8 + 3); // odd length: exercises chunk padding
  data.write('data', 0);
  data.writeUInt32LE(3, 4);
  const body = Buffer.concat([
    Buffer.from('WAVE'),
    fmt,
    data,
    Buffer.alloc(1), // pad byte
    ...extraChunks,
  ]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0);
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
};

const smpl = (start: number, endInclusive: number, loops = 1): Buffer => {
  const b = Buffer.alloc(8 + 36 + 24 * loops);
  b.write('smpl', 0);
  b.writeUInt32LE(36 + 24 * loops, 4);
  b.writeUInt32LE(loops, 8 + 28);
  if (loops > 0) {
    b.writeUInt32LE(start, 8 + 36 + 8);
    b.writeUInt32LE(endInclusive, 8 + 36 + 12);
  }
  return b;
};

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ezga-smpl-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const file = (name: string, content: Buffer) => {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
};

describe('readWavSmplLoop', () => {
  it('reads the first loop after the data chunk (end sample is inclusive)', () => {
    expect(readWavSmplLoop(file('loop.wav', wav([smpl(4410, 26459)])))).toEqual(
      { loopStart: 4410, loopLength: 22050 }
    );
  });

  it('returns null when there is no smpl chunk or no loop in it', () => {
    expect(readWavSmplLoop(file('plain.wav', wav()))).toBeNull();
    expect(
      readWavSmplLoop(file('noloop.wav', wav([smpl(0, 0, 0)])))
    ).toBeNull();
  });

  it('returns null for non-WAV or missing files', () => {
    expect(
      readWavSmplLoop(file('text.wav', Buffer.from('not a wav')))
    ).toBeNull();
    expect(readWavSmplLoop(join(dir, 'missing.wav'))).toBeNull();
  });
});

describe('writeWavSmplLoop', () => {
  it('appends a loop that reads back, and fixes the RIFF size', () => {
    const p = file('w1.wav', wav());
    expect(writeWavSmplLoop(p, 0, 1)).toBe(true);
    expect(readWavSmplLoop(p)).toEqual({ loopStart: 0, loopLength: 1 });
    const bytes = readFileSync(p);
    expect(bytes.readUInt32LE(4)).toBe(bytes.length - 8);
  });

  it('loops to the end when there is no loop length', () => {
    // 3 data bytes, 2 bytes per frame: one whole frame.
    const p = file('w2.wav', wav());
    expect(writeWavSmplLoop(p, 0, NaN)).toBe(true);
    expect(readWavSmplLoop(p)).toEqual({ loopStart: 0, loopLength: 1 });
  });

  it('leaves non-WAV files and files that already have a loop alone', () => {
    const text = file('w3.wav', Buffer.from('not a wav'));
    expect(writeWavSmplLoop(text, 0, 10)).toBe(false);
    expect(readFileSync(text).toString()).toBe('not a wav');

    const looped = wav([smpl(5, 9)]);
    const p = file('w4.wav', looped);
    expect(writeWavSmplLoop(p, 0, 100)).toBe(false);
    expect(readFileSync(p).equals(looped)).toBe(true);
  });
});
