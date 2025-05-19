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
  });
  it("handles valid input and output paths and formats", async () => {
    fs.existsSync.mockReturnValue(true);
    mockRl.question
      .mockResolvedValueOnce("/input/path")
      .mockResolvedValueOnce("/output/path")
      .mockResolvedValueOnce("mp3 wav")
      .mockResolvedValueOnce("ogg");
    const result = await getUserInput(settings);
    expect(result.inputFilePath).toBe("D:/Music/ZClips");
    expect(result.outputFilePath).toBe("e:/Music/ZClips/hhh");
    expect(result.inputFormats).toContain("mp3");
    expect(result.outputFormats).toContain("ogg");
  });
  // Add more tests for invalid paths, folder creation, invalid formats, etc.
});
