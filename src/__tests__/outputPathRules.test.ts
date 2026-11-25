/**
 * Windows filename rules (<>:"|?*) must only apply on Windows. On Linux and
 * macOS those characters are legal, so names like "Track 01: Intro" must pass.
 */
import { describe, it, expect } from '@jest/globals';
import { outputPathHasInvalidCharacters } from '../converterWorker.js';

describe('outputPathHasInvalidCharacters per platform', () => {
  const windowsOnlyNames = [
    '/music/Track 01: Intro.mp3',
    '/music/Why?.mp3',
    '/music/a*b.mp3',
    '/music/a<b>.mp3',
    '/music/a|b.mp3',
    '/music/"Live".mp3',
  ];

  for (const platform of ['linux', 'macos'] as const) {
    it.each(windowsOnlyNames)(`allows %s on ${platform}`, (p) => {
      expect(outputPathHasInvalidCharacters(p, platform)).toBe(false);
    });

    it(`still rejects control characters on ${platform}`, () => {
      expect(outputPathHasInvalidCharacters('/a/b\nc.mp3', platform)).toBe(
        true
      );
      expect(outputPathHasInvalidCharacters('/a/b\x00c.mp3', platform)).toBe(
        true
      );
    });
  }

  it.each(windowsOnlyNames)('rejects %s on windows', (p) => {
    expect(outputPathHasInvalidCharacters(p, 'windows')).toBe(true);
  });

  it('allows the drive-letter colon on windows', () => {
    expect(outputPathHasInvalidCharacters('C:\\Music\\a.mp3', 'windows')).toBe(
      false
    );
  });
});
