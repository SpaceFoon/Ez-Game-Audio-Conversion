const { performance } = require("perf_hooks");
const { settings } = require("../utils");
const chalk = require("chalk");
const { spawn } = require("child_process");
const finalize = require("../finalize");

jest.mock("perf_hooks", () => ({ performance: { now: jest.fn() } }));
jest.mock("../utils", () => ({
  settings: { outputFilePath: "/output" },
  rl: { question: jest.fn(), close: jest.fn() },
}));
jest.mock("chalk", () => ({ blue: jest.fn((a) => a) }));
jest.mock("child_process", () => ({ spawn: jest.fn() }));

describe("finalize", () => {
  let exitSpy;
  beforeEach(() => {
    jest.clearAllMocks();
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
    performance.now.mockReturnValueOnce(0).mockReturnValueOnce(10000);
  });
  afterEach(() => {
    if (exitSpy && exitSpy.mockRestore) exitSpy.mockRestore();
  });
  it("logs successful and failed files and restarts", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const failedFiles = [{ outputFile: "fail.mp3" }];
    const successfulFiles = [{ outputFile: "ok.mp3" }];
    await finalize(failedFiles, successfulFiles, 0);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
  it("logs when there are no successful files", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const failedFiles = [{ outputFile: "fail.mp3" }];
    const successfulFiles = [];
    await finalize(failedFiles, successfulFiles, 0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("NO SUCCESSFUL CONVERSIONS")
    );
    logSpy.mockRestore();
  });
  it("logs when there are no failed files", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const failedFiles = [];
    const successfulFiles = [{ outputFile: "ok.mp3" }];
    await finalize(failedFiles, successfulFiles, 0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("No conversions failed")
    );
    logSpy.mockRestore();
  });
  it("handles both lists empty", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await finalize([], [], 0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("NO SUCCESSFUL CONVERSIONS")
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("No conversions failed")
    );
    logSpy.mockRestore();
  });
  it("calls rl.question and rl.close", async () => {
    const rl = require("../utils").rl;
    rl.question.mockImplementation((msg, cb) => cb());
    rl.close.mockImplementation(() => {});
    await finalize([], [{ outputFile: "ok.mp3" }], 0);
    expect(rl.question).toHaveBeenCalled();
    expect(rl.close).toHaveBeenCalled();
  });
  it("calls spawn and process.exit for restart", async () => {
    const spawn = require("child_process").spawn;
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
    await finalize([], [{ outputFile: "ok.mp3" }], 0);
    expect(spawn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalled();
    exitSpy.mockRestore();
  });
  it("handles undefined arguments gracefully", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await finalize(undefined, undefined, 0);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
  // Add more tests for no successful/failed files, quit logic, etc.
});
