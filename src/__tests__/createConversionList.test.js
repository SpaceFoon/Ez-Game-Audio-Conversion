const fs = require("fs");
const chalk = require("chalk");
const { getAnswer, settings } = require("../utils");
const ExitProgramError = require("../exitProgramError");

jest.mock("fs");
jest.mock("chalk", () => ({
  blue: { bold: jest.fn((...a) => a.join(" ")) },
  blueBright: jest.fn((...a) => a.join(" ")),
  green: { italic: jest.fn((a) => a) },
  cyanBright: jest.fn((...a) => a.join(" ")),
  redBright: { bold: jest.fn((a) => a) },
  red: Object.assign(
    jest.fn((a) => a),
    { bold: jest.fn((a) => a) }
  ),
  yellow: jest.fn((a) => a),
}));
jest.mock("../utils", () => ({
  getAnswer: jest.fn(),
  settings: {},
  handleExit: jest.fn(),
}));

const createConversionList = require("../createConversionList");

describe("createConversionList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require("../utils").handleExit.mockClear();
    settings.inputFilePath = "/input";
    settings.outputFilePath = "/output";
    settings.outputFormats = ["mp3", "ogg"];
    settings.oggCodec = "vorbis";
  });
  it("creates conversion list for unique files", async () => {
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
    getAnswer.mockResolvedValue("yes");
    const files = ["/input/file1.wav", "/input/file2.wav"];
    const result = await createConversionList(files);
    expect(result.length).toBeGreaterThan(0);
  });
  it("handles duplicate output file and renames", async () => {
    fs.existsSync.mockImplementation((path) => path.includes("file1.mp3"));
    fs.mkdirSync.mockImplementation(() => {});
    getAnswer
      .mockResolvedValueOnce("yes")
      .mockResolvedValueOnce("r")
      .mockResolvedValue("yes");
    const files = ["/input/file1.wav", "/input/file2.wav"];
    const result = await createConversionList(files);
    expect(result.some((x) => x.outputFile.includes("-copy"))).toBe(true);
  });
  it("prompts for ogg codec and handles invalid then valid input", async () => {
    settings.oggCodec = undefined;
    getAnswer
      .mockResolvedValueOnce("invalid")
      .mockResolvedValueOnce("") // fallback to vorbis
      .mockResolvedValue("yes");
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
    const files = ["/input/file1.wav"];
    const result = await createConversionList(files);
    expect(settings.oggCodec).toBe("vorbis");
    expect(result.length).toBe(2); // mp3 and ogg
  });
  it("skips conversion to same file type when user says no", async () => {
    settings.inputFilePath = "/input";
    settings.outputFilePath = "/input";
    getAnswer.mockResolvedValueOnce("no").mockResolvedValue("yes");
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
    const files = ["/input/file1.mp3"];
    const handleExit = require("../utils").handleExit;
    await createConversionList(files);
    expect(handleExit).toHaveBeenCalledWith(0);
  });
  it("cancels conversion if user says no at final prompt", async () => {
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
    settings.outputFormats = ["mp3"];
    let callCount = 0;
    getAnswer.mockImplementation(() => {
      callCount++;
      if (callCount < 2) return Promise.resolve("yes");
      return Promise.resolve("no");
    });
    const files = ["/input/file1.wav"];
    const handleExit = require("../utils").handleExit;
    await createConversionList(files);
    expect(handleExit).toHaveBeenCalledWith(0);
  });
  it("handles directory creation error", async () => {
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {
      throw new Error("mkdir error");
    });
    getAnswer.mockResolvedValue("yes");
    const files = ["/input/file1.wav"];
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const handleExit = require("../utils").handleExit;
    try {
      await createConversionList(files);
    } catch (e) {
      expect(e).toBeInstanceOf(ExitProgramError);
    }
    expect(errorSpy).toHaveBeenCalled();
    expect(handleExit).toHaveBeenCalledWith(1);
    errorSpy.mockRestore();
  });
  it("filters out skipped files from the final list", async () => {
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
    getAnswer.mockResolvedValueOnce("no").mockResolvedValueOnce("yes");
    settings.inputFilePath = "/input";
    settings.outputFilePath = "/input";
    const files = ["/input/file1.mp3"];
    const handleExit = require("../utils").handleExit;
    try {
      await createConversionList(files);
    } catch (e) {
      expect(e).toBeInstanceOf(ExitProgramError);
    }
    expect(handleExit).toHaveBeenCalledWith(0);
  });
  // Add more tests for duplicate files, user prompts, ogg codec selection, etc.
});
