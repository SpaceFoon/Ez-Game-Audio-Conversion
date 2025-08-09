// src/__tests__/utils.test.js
// Import the module directly
const utils = require("../../src/utils");
const fs = require("fs");
const chalk = require("chalk");
const moment = require("moment");

// Mock dependencies
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
  openSync: jest.fn(),
  closeSync: jest.fn(),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.mock("chalk", () => ({
  red: { bold: jest.fn((text) => text) },
  yellow: { bold: jest.fn((text) => text) },
  redBright: jest.fn((text) => text),
}));

jest.mock("moment", () => {
  return jest.fn(() => ({
    format: jest.fn(() => "01-01-2023 12:00:00"),
  }));
});

describe("utils module", () => {
  // Capture original console implementation
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  // Original functions that we'll restore in afterEach
  const origReadline = utils.rl.question;
  const origConsoleError = utils.originalConsoleError;
  const origConsoleWarn = utils.originalConsolWarn;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();

    // Mock readline question
    utils.rl.question = jest.fn((_, callback) => callback("test-answer"));

    // Setup internal log files
    utils.fileNameL = "/test/output/logs.csv";
    utils.fileNameE = "/test/output/error.csv";
  });

  afterEach(() => {
    // Restore original console and readline
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    utils.rl.question = origReadline;
  });

  it("should export expected functions and objects", () => {
    expect(utils.settings).toBeDefined();
    expect(typeof utils.initializeFileNames).toBe("function");
    expect(typeof utils.getAnswer).toBe("function");
    expect(typeof utils.isFileBusy).toBe("function");
    expect(typeof utils.addToLog).toBe("function");
    expect(typeof utils.checkDiskSpace).toBe("function");
  });

  it("should have correct structure in settings object", () => {
    expect(utils.settings).toHaveProperty("inputFilePath");
    expect(utils.settings).toHaveProperty("outputFilePath");
    expect(utils.settings).toHaveProperty("inputFormats");
    expect(utils.settings).toHaveProperty("outputFormats");
    expect(utils.settings).toHaveProperty("oggCodec");
  });

  describe("getAnswer function", () => {
    it("should return a promise that resolves with user input", async () => {
      const answer = await utils.getAnswer("Test question");
      expect(answer).toBe("test-answer");
      expect(utils.rl.question).toHaveBeenCalledWith(
        "Test question",
        expect.any(Function)
      );
    });

    it("should handle array inputs (from chalk)", async () => {
      const answer = await utils.getAnswer(["Test", "question"]);
      expect(answer).toBe("test-answer");
      expect(utils.rl.question).toHaveBeenCalledWith(
        "Test question",
        expect.any(Function)
      );
    });
  });

  describe("checkDiskSpace function", () => {
    it("should return true when disk space check succeeds", () => {
      fs.statSync.mockReturnValueOnce({ isFile: () => false });
      expect(utils.checkDiskSpace("/test/dir")).toBe(true);
      expect(fs.statSync).toHaveBeenCalledWith("/test/dir");
    });

    it("should return true when directory is not provided", () => {
      fs.statSync.mockReturnValueOnce({ isFile: () => false });
      expect(utils.checkDiskSpace()).toBe(true);
      expect(fs.statSync).toHaveBeenCalled();
    });

    it("should return true even when errors occur (fail-safe)", () => {
      fs.statSync.mockImplementationOnce(() => {
        throw new Error("Test error");
      });
      expect(utils.checkDiskSpace("/test/dir")).toBe(true);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("isFileBusy function", () => {
    it("should return false if file does not exist", async () => {
      fs.existsSync.mockReturnValueOnce(false);
      const result = await utils.isFileBusy("/test/file.txt");
      expect(result).toBe(false);
    });

    it("should return false if file is not busy", async () => {
      fs.existsSync.mockReturnValueOnce(true);
      fs.openSync.mockReturnValueOnce(123);
      const result = await utils.isFileBusy("/test/file.txt");
      expect(result).toBe(false);
      expect(fs.openSync).toHaveBeenCalledWith("/test/file.txt", "r+");
      expect(fs.closeSync).toHaveBeenCalledWith(123);
    });

    it("should handle EBUSY error", async () => {
      fs.existsSync.mockReturnValueOnce(true);
      const error = new Error("File is busy");
      error.code = "EBUSY";
      fs.openSync.mockImplementationOnce(() => {
        throw error;
      });

      // Create a promise that resolves after a short delay to handle the async question
      const promise = utils.isFileBusy("/test/file.txt");

      // We need to wait a tick to allow the async callback to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(utils.rl.question).toHaveBeenCalled();
      await promise;
    });
  });

  describe("initializeFileNames function", () => {
    it("should initialize file names for logs and errors", () => {
      utils.settings.outputFilePath = "/test/output";
      utils.initializeFileNames();
      // Verify calls to existsSync
      expect(fs.existsSync).toHaveBeenCalledWith("/test/output/logs.csv");
      expect(fs.existsSync).toHaveBeenCalledWith("/test/output/error.csv");
    });
  });

  describe("addToLog function", () => {
    beforeEach(() => {
      // Set up test environment
      utils.settings.outputFilePath = "/test/output";
      utils.initializeFileNames();

      // Reset mocks after initializeFileNames has been called
      jest.clearAllMocks();
    });

    it("should create a new log file when it doesn't exist", async () => {
      // First check if file exists (no)
      fs.existsSync.mockReturnValueOnce(false);

      await utils.addToLog(
        { type: "code", data: "0" },
        { inputFile: "input.wav", outputFile: "output.mp3" },
        0
      );

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should append to existing log file", async () => {
      // First check if file exists (yes)
      fs.existsSync.mockReturnValueOnce(true);

      await utils.addToLog(
        { type: "code", data: "0" },
        { inputFile: "input.wav", outputFile: "output.mp3" },
        0
      );

      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    it("should create a new error log file when it doesn't exist", async () => {
      // First check if file exists (no)
      fs.existsSync.mockReturnValueOnce(false);

      await utils.addToLog(
        { type: "stderr", data: "Test error" },
        { inputFile: "input.wav", outputFile: "output.mp3" },
        0
      );

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should append to existing error log file", async () => {
      // Setup fileNameE
      utils.fileNameE = "/test/output/error.csv";

      // First check if file exists (yes)
      fs.existsSync.mockReturnValue(true);

      // Ensure appendFileSync is called properly
      fs.appendFileSync.mockImplementation(() => true);

      await utils.addToLog(
        { type: "stderr", data: "Test error" },
        { inputFile: "input.wav", outputFile: "output.mp3" },
        0
      );

      // Now appendFileSync should have been called
      expect(fs.appendFileSync).toHaveBeenCalled();
    });
  });
});
