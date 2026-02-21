import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ESM mocks must be declared BEFORE dynamic imports
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => ({
  default: {
    blue: { bold: jest.fn((...a) => a.join(' ')) },
    green: { italic: jest.fn((a) => a) },
  },
  blue: { bold: jest.fn((...a) => a.join(' ')) },
  green: { italic: jest.fn((a) => a) },
}));

jest.unstable_mockModule('../utils.js', () => ({
  getAnswer: jest.fn(),
}));

// Dynamic imports after mock declarations
const fs = await import('fs');
const { getAnswer } = await import('../utils.js');
const { default: getUserInput } = await import('../getUserInput.js');

describe('getUserInput', () => {
  let settings;
  beforeEach(() => {
    settings = {};
    jest.clearAllMocks();
    // Clear CLI args to force interactive mode in tests
    process.argv = [process.argv[0], process.argv[1]];
  });

  it('handles valid input and output paths and formats', async () => {
    // Mock path existence
    fs.existsSync.mockReturnValue(true);
    // Mock statSync to be used when code checks CLI arg path; not used in this test but safe
    fs.statSync.mockReturnValue({
      isFile: () => false,
      isDirectory: () => true,
    });

    // Prompt sequence: input folder, output folder, input formats, output formats
    getAnswer
      .mockResolvedValueOnce('/input/path')
      .mockResolvedValueOnce('/output/path')
      .mockResolvedValueOnce('mp3 wav')
      .mockResolvedValueOnce('ogg');

    const result = await getUserInput(settings);

    expect(result.inputFilePath).toBe('/input/path');
    expect(result.outputFilePath).toBe('/output/path');
    expect(result.inputFormats).toEqual(['mp3', 'wav']);
    expect(result.outputFormats).toEqual(['ogg']);
  });
});
