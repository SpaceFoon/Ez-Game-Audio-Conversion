const fs = require("fs");
const chalk = require("chalk");
const readline = require("readline/promises");

jest.mock("fs");
jest.mock("chalk", () => ({
  blue: { bold: jest.fn((...a) => a.join(" ")) },
  green: { italic: jest.fn((a) => a) },
}));
jest.mock("../utils", () => ({ checkDiskSpace: jest.fn() }));

const mockRl = { question: jest.fn() };
jest.mock("readline/promises", () => ({ createInterface: () => mockRl }));

const getUserInput = require("../getUserInput");

describe("getUserInput", () => {
  let settings;
  beforeEach(() => {
    settings = {};
    jest.clearAllMocks();
    // Clear CLI args to force interactive mode in tests
    process.argv = [process.argv[0], process.argv[1]];
  });
  it("handles valid input and output paths and formats", async () => {
    // Mock path existence
    fs.existsSync.mockReturnValue(true);
    // Mock statSync to be used when code checks CLI arg path; not used in this test but safe
    fs.statSync = jest.fn(() => ({
      isFile: () => false,
      isDirectory: () => true,
    }));

    // Prompt sequence: input folder, output folder, input formats, output formats
    mockRl.question
      .mockResolvedValueOnce("/input/path")
      .mockResolvedValueOnce("/output/path")
      .mockResolvedValueOnce("mp3 wav")
      .mockResolvedValueOnce("ogg");

    const result = await getUserInput(settings);

    expect(result.inputFilePath).toBe("/input/path");
    expect(result.outputFilePath).toBe("/output/path");
    expect(result.inputFormats).toEqual(["mp3", "wav"]);
    expect(result.outputFormats).toEqual(["ogg"]);
  });
});
