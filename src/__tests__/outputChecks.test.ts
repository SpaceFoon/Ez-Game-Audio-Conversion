/** Header-only FLAC detection (B49). */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isEmptyFlac } from '../outputChecks.js';

// "fLaC" + STREAMINFO block header + 34-byte STREAMINFO.
const flac = (totalSamples: number, blockType = 0): Buffer => {
  const b = Buffer.alloc(8 + 34);
  b.write('fLaC', 0, 'ascii');
  b[4] = 0x80 | blockType; // last-metadata-block flag + type
  b.writeUIntBE(34, 5, 3);
  b[21] = 0x40 | Math.floor(totalSamples / 2 ** 32); // high bits share the byte
  b.writeUInt32BE(totalSamples % 2 ** 32, 22);
  return b;
};

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'ezga-flac-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const file = (name: string, content: Buffer | string) => {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
};

describe('isEmptyFlac', () => {
  it('is true only when STREAMINFO reports zero samples', () => {
    expect(isEmptyFlac(file('empty.flac', flac(0)))).toBe(true);
    expect(isEmptyFlac(file('one.flac', flac(1)))).toBe(false);
    expect(isEmptyFlac(file('big.flac', flac(2 ** 32)))).toBe(false);
  });

  it('is false for non-FLAC, short, unexpected or missing files', () => {
    expect(isEmptyFlac(file('text.flac', 'not a flac file at all, no'))).toBe(
      false
    );
    expect(isEmptyFlac(file('short.flac', Buffer.from('fLaC')))).toBe(false);
    expect(isEmptyFlac(file('odd.flac', flac(0, 4)))).toBe(false);
    expect(isEmptyFlac(join(dir, 'missing.flac'))).toBe(false);
  });
});
