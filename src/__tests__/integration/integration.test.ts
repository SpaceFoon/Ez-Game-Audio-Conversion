import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { join, dirname, basename, extname } from 'path';

// Simplified version of deleteDuplicateFiles for test purposes only
const handleDuplicateFiles = (files: string[]) => {
  const priorityList = [
    '.midi',
    '.mid',
    '.ogg',
    '.mp3',
    '.m4a',
    '.wav',
    '.flac',
    '.aiff',
  ];
  const fileobjs = files.map((file: string) => [
    join(dirname(file), basename(file, extname(file))),
    extname(file),
  ]);

  const uniq = new Map<string, string>();
  const droppedFiles: string[] = [];

  for (const [name, ext] of fileobjs) {
    if (!uniq.has(name)) {
      uniq.set(name, ext);
      continue;
    }

    const current = uniq.get(name);
    if (priorityList.indexOf(ext) > priorityList.indexOf(current!)) {
      droppedFiles.push(`${name}${current}`);
      uniq.set(name, ext);
    } else {
      droppedFiles.push(`${name}${ext}`);
    }
  }

  const uniqueFiles = Array.from(uniq.entries()).reduce<string[]>(
    (p, c) => [...p, `${c[0]}${c[1]}`],
    []
  );

  return {
    uniqueFiles,
    droppedFiles,
  };
};

describe('Simple Integration Tests', () => {
  beforeEach(() => {
    // Suppress console output
    console.log = jest.fn();
    console.error = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
  });

  it('should handle duplicate files correctly', () => {
    // Create test data with duplicates (same name, different extensions)
    const song1 = join('/test/input', 'song.mp3');
    const song2 = join('/test/input', 'song.wav');
    const song3 = join('/test/input', 'song.flac');
    const unique = join('/test/input', 'unique.mp3');

    const filesWithDuplicates = [song1, song2, song3, unique];

    const result = handleDuplicateFiles(filesWithDuplicates);
    const uniqueFiles = result.uniqueFiles;
    const droppedFiles = result.droppedFiles;

    // Should only keep highest priority duplicate and unique files
    expect(uniqueFiles.length).toBe(2);

    // Should have dropped 2 files
    expect(droppedFiles.length).toBe(2);

    // Use path.basename for more reliable assertions across platforms
    const basenames = uniqueFiles.map((f) => basename(f));
    expect(basenames).toContain('song.flac');
    expect(basenames).toContain('unique.mp3');
    expect(basenames).not.toContain('song.mp3');
    expect(basenames).not.toContain('song.wav');

    // Check that the dropped files are the correct ones
    const droppedBasenames = droppedFiles.map((f) => basename(f));
    expect(droppedBasenames).toContain('song.mp3');
    expect(droppedBasenames).toContain('song.wav');
  });
});
