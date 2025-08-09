describe("app.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs the happy path (all promises resolve)", async () => {
    jest.resetModules();
    const mockGetUserInput = jest.fn().mockResolvedValue({});
    const mockSearchFiles = jest.fn().mockResolvedValue(["file1"]);
    const mockCreateConversionList = jest.fn().mockResolvedValue(["file2"]);
    const mockConvertFiles = jest.fn().mockResolvedValue({
      failedFiles: [],
      successfulFiles: ["file2"],
      jobStartTime: 0,
    });
    const mockFinalize = jest.fn().mockResolvedValue();
    const mockCfonts = { say: jest.fn() };
    const mockOs = {
      platform: jest.fn(),
      arch: jest.fn(),
      cpus: jest.fn(() => [1, 2, 3, 4]),
      release: jest.fn(() => "test"),
    };
    jest.doMock("../getUserInput", () => mockGetUserInput);
    jest.doMock("../searchFiles", () => mockSearchFiles);
    jest.doMock("../createConversionList", () => mockCreateConversionList);
    jest.doMock("../convertFiles", () => ({ convertFiles: mockConvertFiles }));
    jest.doMock("../finalize", () => mockFinalize);
    jest.doMock("cfonts", () => mockCfonts);
    jest.doMock("os", () => mockOs);
    jest.doMock("dotenv", () => ({ config: jest.fn() }));
    await jest.isolateModulesAsync(async () => {
      const runApp = require("../app");
      await runApp();
    });
    expect(mockGetUserInput).toHaveBeenCalled();
    expect(mockSearchFiles).toHaveBeenCalled();
    expect(mockCreateConversionList).toHaveBeenCalled();
    expect(mockConvertFiles).toHaveBeenCalled();
    expect(mockFinalize).toHaveBeenCalled();
  });

  it("handles errors in the promise chain", async () => {
    jest.resetModules();
    const mockGetUserInput = jest.fn().mockRejectedValue(new Error("fail"));
    const mockSearchFiles = jest.fn();
    const mockCreateConversionList = jest.fn();
    const mockConvertFiles = jest.fn();
    const mockFinalize = jest.fn();
    const mockCfonts = { say: jest.fn() };
    const mockOs = {
      platform: jest.fn(),
      arch: jest.fn(),
      cpus: jest.fn(() => [1, 2, 3, 4]),
      release: jest.fn(() => "test"),
    };
    jest.doMock("../getUserInput", () => mockGetUserInput);
    jest.doMock("../searchFiles", () => mockSearchFiles);
    jest.doMock("../createConversionList", () => mockCreateConversionList);
    jest.doMock("../convertFiles", () => ({ convertFiles: mockConvertFiles }));
    jest.doMock("../finalize", () => mockFinalize);
    jest.doMock("cfonts", () => mockCfonts);
    jest.doMock("os", () => mockOs);
    jest.doMock("dotenv", () => ({ config: jest.fn() }));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await jest.isolateModulesAsync(async () => {
      const runApp = require("../app");
      await runApp();
    });
    expect(errorSpy).toHaveBeenCalled();
    const call = errorSpy.mock.calls[0];
    console.log(
      "DEBUG call[1] type:",
      typeof call[1],
      "value:",
      call[1],
      "prototype:",
      Object.getPrototypeOf(call[1])
    );
    expect(call[1]).toContain("fail");
    errorSpy.mockRestore();
  });

  it("does not reinitialize globalThis.env if already set", async () => {
    jest.resetModules();
    globalThis.env = { already: true };
    const mockGetUserInput = jest.fn().mockResolvedValue({});
    const mockSearchFiles = jest.fn().mockResolvedValue(["file1"]);
    const mockCreateConversionList = jest.fn().mockResolvedValue(["file2"]);
    const mockConvertFiles = jest.fn().mockResolvedValue({
      failedFiles: [],
      successfulFiles: ["file2"],
      jobStartTime: 0,
    });
    const mockFinalize = jest.fn().mockResolvedValue();
    const mockCfonts = { say: jest.fn() };
    const mockOs = {
      platform: jest.fn(() => "win32"),
      arch: jest.fn(),
      cpus: jest.fn(() => [1, 2, 3, 4]),
      release: jest.fn(() => "test"),
    };
    jest.doMock("../getUserInput", () => mockGetUserInput);
    jest.doMock("../searchFiles", () => mockSearchFiles);
    jest.doMock("../createConversionList", () => mockCreateConversionList);
    jest.doMock("../convertFiles", () => ({ convertFiles: mockConvertFiles }));
    jest.doMock("../finalize", () => mockFinalize);
    jest.doMock("cfonts", () => mockCfonts);
    jest.doMock("os", () => mockOs);
    jest.doMock("dotenv", () => ({ config: jest.fn() }));
    await jest.isolateModulesAsync(async () => {
      const runApp = require("../app");
      await runApp();
    });
    expect(globalThis.env).toEqual({ already: true });
  });

  it("requires ./converterWorker if PKG_ENV is packaging", async () => {
    jest.resetModules();
    process.env.PKG_ENV = "packaging";
    let converterWorkerLoaded = false;
    jest.doMock("../converterWorker", () => {
      converterWorkerLoaded = true;
      return {};
    });
    const mockGetUserInput = jest.fn().mockResolvedValue({});
    const mockSearchFiles = jest.fn().mockResolvedValue(["file1"]);
    const mockCreateConversionList = jest.fn().mockResolvedValue(["file2"]);
    const mockConvertFiles = jest.fn().mockResolvedValue({
      failedFiles: [],
      successfulFiles: ["file2"],
      jobStartTime: 0,
    });
    const mockFinalize = jest.fn().mockResolvedValue();
    const mockCfonts = { say: jest.fn() };
    const mockOs = {
      platform: jest.fn(() => "win32"),
      arch: jest.fn(),
      cpus: jest.fn(() => [1, 2, 3, 4]),
      release: jest.fn(() => "test"),
    };
    jest.doMock("../getUserInput", () => mockGetUserInput);
    jest.doMock("../searchFiles", () => mockSearchFiles);
    jest.doMock("../createConversionList", () => mockCreateConversionList);
    jest.doMock("../convertFiles", () => ({ convertFiles: mockConvertFiles }));
    jest.doMock("../finalize", () => mockFinalize);
    jest.doMock("cfonts", () => mockCfonts);
    jest.doMock("os", () => mockOs);
    jest.doMock("dotenv", () => ({ config: jest.fn() }));
    await jest.isolateModulesAsync(async () => {
      const runApp = require("../app");
      await runApp();
    });
    expect(converterWorkerLoaded).toBe(true);
    delete process.env.PKG_ENV;
  });

  it("logs debug mode and TTY info if env.isDebug is true", async () => {
    jest.resetModules();
    globalThis.env = {
      isDebug: true,
      isDev: false,
      isPkg: false,
      isWindows: true,
      isMac: false,
      isLinux: false,
      arch: "x64",
      platform: "win32",
      cpuCount: 4,
    };
    const mockGetUserInput = jest.fn().mockResolvedValue({});
    const mockSearchFiles = jest.fn().mockResolvedValue(["file1"]);
    const mockCreateConversionList = jest.fn().mockResolvedValue(["file2"]);
    const mockConvertFiles = jest.fn().mockResolvedValue({
      failedFiles: [],
      successfulFiles: ["file2"],
      jobStartTime: 0,
    });
    const mockFinalize = jest.fn().mockResolvedValue();
    const mockCfonts = { say: jest.fn() };
    const mockOs = {
      platform: jest.fn(() => "win32"),
      arch: jest.fn(),
      cpus: jest.fn(() => [1, 2, 3, 4]),
      release: jest.fn(() => "test"),
    };
    jest.doMock("../getUserInput", () => mockGetUserInput);
    jest.doMock("../searchFiles", () => mockSearchFiles);
    jest.doMock("../createConversionList", () => mockCreateConversionList);
    jest.doMock("../convertFiles", () => ({ convertFiles: mockConvertFiles }));
    jest.doMock("../finalize", () => mockFinalize);
    jest.doMock("cfonts", () => mockCfonts);
    jest.doMock("os", () => mockOs);
    jest.doMock("dotenv", () => ({ config: jest.fn() }));
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const origStdin = process.stdin;
    const origStdout = process.stdout;
    process.stdin = { isTTY: true };
    process.stdout = { isTTY: true, write: jest.fn() };
    await jest.isolateModulesAsync(async () => {
      const runApp = require("../app");
      await runApp();
    });
    expect(logSpy).toHaveBeenCalledWith("debug mode");
    expect(logSpy).toHaveBeenCalledWith("stdin is TTY:", true);
    expect(logSpy).toHaveBeenCalledWith("stdout is TTY:", true);
    logSpy.mockRestore();
    process.stdin = origStdin;
    process.stdout = origStdout;
  });

  it("logs dev mode if env.isDev is true", async () => {
    jest.resetModules();
    globalThis.env = {
      isDebug: false,
      isDev: true,
      isPkg: false,
      isWindows: true,
      isMac: false,
      isLinux: false,
      arch: "x64",
      platform: "win32",
      cpuCount: 4,
    };
    const mockGetUserInput = jest.fn().mockResolvedValue({});
    const mockSearchFiles = jest.fn().mockResolvedValue(["file1"]);
    const mockCreateConversionList = jest.fn().mockResolvedValue(["file2"]);
    const mockConvertFiles = jest.fn().mockResolvedValue({
      failedFiles: [],
      successfulFiles: ["file2"],
      jobStartTime: 0,
    });
    const mockFinalize = jest.fn().mockResolvedValue();
    const mockCfonts = { say: jest.fn() };
    const mockOs = {
      platform: jest.fn(() => "win32"),
      arch: jest.fn(),
      cpus: jest.fn(() => [1, 2, 3, 4]),
      release: jest.fn(() => "test"),
    };
    jest.doMock("../getUserInput", () => mockGetUserInput);
    jest.doMock("../searchFiles", () => mockSearchFiles);
    jest.doMock("../createConversionList", () => mockCreateConversionList);
    jest.doMock("../convertFiles", () => ({ convertFiles: mockConvertFiles }));
    jest.doMock("../finalize", () => mockFinalize);
    jest.doMock("cfonts", () => mockCfonts);
    jest.doMock("os", () => mockOs);
    jest.doMock("dotenv", () => ({ config: jest.fn() }));
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await jest.isolateModulesAsync(async () => {
      const runApp = require("../app");
      await runApp();
    });
    expect(logSpy).toHaveBeenCalledWith("in dev mode");
    logSpy.mockRestore();
  });

  it("writes to process.stdout for terminal title", async () => {
    jest.resetModules();
    const mockGetUserInput = jest.fn().mockResolvedValue({});
    const mockSearchFiles = jest.fn().mockResolvedValue(["file1"]);
    const mockCreateConversionList = jest.fn().mockResolvedValue(["file2"]);
    const mockConvertFiles = jest.fn().mockResolvedValue({
      failedFiles: [],
      successfulFiles: ["file2"],
      jobStartTime: 0,
    });
    const mockFinalize = jest.fn().mockResolvedValue();
    const mockCfonts = { say: jest.fn() };
    const mockOs = {
      platform: jest.fn(() => "win32"),
      arch: jest.fn(),
      cpus: jest.fn(() => [1, 2, 3, 4]),
      release: jest.fn(() => "test"),
    };
    jest.doMock("../getUserInput", () => mockGetUserInput);
    jest.doMock("../searchFiles", () => mockSearchFiles);
    jest.doMock("../createConversionList", () => mockCreateConversionList);
    jest.doMock("../convertFiles", () => ({ convertFiles: mockConvertFiles }));
    jest.doMock("../finalize", () => mockFinalize);
    jest.doMock("cfonts", () => mockCfonts);
    jest.doMock("os", () => mockOs);
    jest.doMock("dotenv", () => ({ config: jest.fn() }));
    const writeSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => {});
    await jest.isolateModulesAsync(async () => {
      const runApp = require("../app");
      await runApp();
    });
    expect(writeSpy).toHaveBeenCalledWith("\x1b]0;EZ Game Audio\x1b\x5c");
    expect(writeSpy).toHaveBeenCalledWith("\x1b]2;EZ Game Audio\x1b\x5c");
    writeSpy.mockRestore();
  });

  it("sets settings.userOS correctly for Windows and non-Windows", async () => {
    jest.resetModules();
    const mockGetUserInput = jest.fn().mockResolvedValue({});
    const mockSearchFiles = jest.fn().mockResolvedValue(["file1"]);
    const mockCreateConversionList = jest.fn().mockResolvedValue(["file2"]);
    const mockConvertFiles = jest.fn().mockResolvedValue({
      failedFiles: [],
      successfulFiles: ["file2"],
      jobStartTime: 0,
    });
    const mockFinalize = jest.fn().mockResolvedValue();
    const mockCfonts = { say: jest.fn() };
    const mockOsWin = {
      platform: jest.fn(() => "win32"),
      arch: jest.fn(),
      cpus: jest.fn(() => [1, 2, 3, 4]),
      release: jest.fn(() => "test"),
    };
    const mockOsNonWin = {
      platform: jest.fn(() => "linux"),
      arch: jest.fn(),
      cpus: jest.fn(() => [1, 2, 3, 4]),
      release: jest.fn(() => "test"),
    };
    jest.doMock("../getUserInput", () => mockGetUserInput);
    jest.doMock("../searchFiles", () => mockSearchFiles);
    jest.doMock("../createConversionList", () => mockCreateConversionList);
    jest.doMock("../convertFiles", () => ({ convertFiles: mockConvertFiles }));
    jest.doMock("../finalize", () => mockFinalize);
    jest.doMock("cfonts", () => mockCfonts);
    jest.doMock("os", () => mockOsWin);
    jest.doMock("dotenv", () => ({ config: jest.fn() }));
    await jest.isolateModulesAsync(async () => {
      const runApp = require("../app");
      const { settings } = require("../utils");
      await runApp();
      expect(settings.userOS).toBe("ffprobe.exe");
    });
    jest.resetModules();
    jest.doMock("../getUserInput", () => mockGetUserInput);
    jest.doMock("../searchFiles", () => mockSearchFiles);
    jest.doMock("../createConversionList", () => mockCreateConversionList);
    jest.doMock("../convertFiles", () => ({ convertFiles: mockConvertFiles }));
    jest.doMock("../finalize", () => mockFinalize);
    jest.doMock("cfonts", () => mockCfonts);
    jest.doMock("os", () => mockOsNonWin);
    jest.doMock("dotenv", () => ({ config: jest.fn() }));
    await jest.isolateModulesAsync(async () => {
      const runApp = require("../app");
      const { settings } = require("../utils");
      await runApp();
      expect(settings.userOS).toBe("ffprobe");
    });
  });

  // Add more tests for environment setup, debug/dev branches, and edge cases
});
