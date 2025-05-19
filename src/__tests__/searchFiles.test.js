const searchFiles = require("../../src/searchFiles");
const fs = require("fs");
const chalk = require("chalk");
const path = require("path");

// Mock dependencies
jest.mock("fs", () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.mock("chalk", () => ({
  whiteBright: {
    bold: jest.fn((text) => text),
  },
  white: jest.fn((text) => text),
}));

describe("searchFiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console.log to avoid polluting test output
    console.log = jest.fn();
  });

  it("should find files with matching extensions", async () => {
    // Mock file structure
    fs.readdirSync.mockReturnValueOnce(["file1.mp3", "file2.txt", "subdir"]);
    fs.readdirSync.mockReturnValueOnce(["file3.wav", "file4.jpg"]);

    // Mock file stats
    fs.statSync
      .mockImplementationOnce((path) => ({
        isDirectory: () => false, // file1.mp3
      }))
      .mockImplementationOnce((path) => ({
        isDirectory: () => false, // file2.txt
      }))
      .mockImplementationOnce((path) => ({
        isDirectory: () => true, // subdir
      }))
      .mockImplementationOnce((path) => ({
        isDirectory: () => false, // file3.wav
      }))
      .mockImplementationOnce((path) => ({
        isDirectory: () => false, // file4.jpg
      }));

    const settings = {
      inputFilePath: "/test/dir",
      inputFormats: ["mp3", "wav"],
    };

    const result = await searchFiles(settings);
    const expectedFile1 = path.join("/test/dir", "file1.mp3");
    const expectedFile2 = path.join("/test/dir", "subdir", "file3.wav");

    // Should find file1.mp3 and file3.wav
    expect(result).toHaveLength(2);
    expect(result.some((file) => file.endsWith(expectedFile1))).toBe(true);
    expect(result.some((file) => file.endsWith(expectedFile2))).toBe(true);
    expect(result.every((file) => !file.endsWith("file2.txt"))).toBe(true);
    expect(
      result.every((file) => !file.endsWith(path.join("subdir", "file4.jpg")))
    ).toBe(true);
  });

  it("should handle midi files with both .mid and .midi extensions", async () => {
    // Mock file structure with midi files
    fs.readdirSync.mockReturnValueOnce([
      "song1.mid",
      "song2.midi",
      "song3.mp3",
    ]);

    // Mock stats to make all files non-directories
    fs.statSync.mockImplementation((path) => ({
      isDirectory: () => false,
    }));

    const settings = {
      inputFilePath: "/test/dir",
      inputFormats: ["midi", "mp3"],
    };

    const result = await searchFiles(settings);

    // Should find all three files
    expect(result).toHaveLength(3);
    expect(result.some((file) => file.endsWith("song1.mid"))).toBe(true);
    expect(result.some((file) => file.endsWith("song2.midi"))).toBe(true);
    expect(result.some((file) => file.endsWith("song3.mp3"))).toBe(true);
  });

  it("should return an empty array when no matching files are found", async () => {
    // Mock empty directory
    fs.readdirSync.mockReturnValueOnce(["file1.txt", "file2.jpg"]);

    // Mock stats
    fs.statSync.mockImplementation((path) => ({
      isDirectory: () => false,
    }));

    const settings = {
      inputFilePath: "/test/dir",
      inputFormats: ["mp3", "wav"],
    };

    const result = await searchFiles(settings);

    // Should not find any files
    expect(result).toHaveLength(0);
  });
});
