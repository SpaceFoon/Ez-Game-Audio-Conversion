import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join, basename } from 'path';
import { resolveDuplicateBasenames } from '../../searchFiles.js';

describe('Simple Integration Tests', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should handle duplicate files correctly', () => {
    const song1 = join('/test/input', 'song.mp3');
    const song2 = join('/test/input', 'song.wav');
    const song3 = join('/test/input', 'song.flac');
    const unique = join('/test/input', 'unique.mp3');

    const filesWithDuplicates = [song1, song2, song3, unique];
    const { uniqueFiles, droppedFiles } =
      resolveDuplicateBasenames(filesWithDuplicates);

    expect(uniqueFiles.length).toBe(2);
    expect(droppedFiles.length).toBe(2);

    const basenames = uniqueFiles.map((f) => basename(f));
    expect(basenames).toContain('song.flac');
    expect(basenames).toContain('unique.mp3');
    expect(basenames).not.toContain('song.mp3');
    expect(basenames).not.toContain('song.wav');

    const droppedBasenames = droppedFiles.map((f) => basename(f));
    expect(droppedBasenames).toContain('song.mp3');
    expect(droppedBasenames).toContain('song.wav');
  });
});
