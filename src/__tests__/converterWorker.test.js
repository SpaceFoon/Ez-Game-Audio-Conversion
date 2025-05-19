const fs = require("fs");
const { parentPort } = require("worker_threads");
const {
  getMetaData,
  formatMetaData,
  convertLoopPoints,
  formatLoopData,
} = require("../metaDataService");

// Mock dependencies
jest.mock("fs");
jest.mock("../metaDataService", () => ({
  getMetaData: jest.fn(),
  formatMetaData: jest.fn(),
  convertLoopPoints: jest.fn(),
  formatLoopData: jest.fn(),
}));

jest.mock("worker_threads", () => ({
  parentPort: { postMessage: jest.fn() },
  workerData: {},
}));

// Mock child_process to prevent actual ffmpeg execution
jest.mock("child_process", () => ({
  spawn: jest.fn(() => {
    const mockProcess = {
      on: jest.fn((event, callback) => {
        if (event === "exit") {
          // Immediately trigger success exit
          setTimeout(() => callback(0), 0);
        }
        return mockProcess;
      }),
      stderr: {
        on: jest.fn(),
      },
    };
    return mockProcess;
  }),
}));

// Mock the path module to return predictable paths
jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
  dirname: jest.fn((path) => path.split("/").slice(0, -1).join("/")),
  basename: jest.fn((path) => path.split("/").pop()),
  extname: jest.fn((path) => {
    const parts = path.split(".");
    return parts.length > 1 ? `.${parts.pop()}` : "";
  }),
}));

describe("converterWorker.js", () => {
  let mockRunFFMPEG;
  let originalEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Save original NODE_ENV and set it to test
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";

    // Setup default mocks for metaDataService
    require("../metaDataService").getMetaData.mockResolvedValue({
      streams: [{ sample_rate: 44100 }],
    });
    require("../metaDataService").formatMetaData.mockReturnValue({
      metaData: "-metadata title=Test",
      channels: "-ac 2",
    });
    require("../metaDataService").convertLoopPoints.mockReturnValue({
      newSampleRate: null,
      loopStart: null,
      loopLength: null,
    });
    require("../metaDataService").formatLoopData.mockReturnValue("");

    // Mock runFFMPEG function to return instantly instead of running real ffmpeg
    mockRunFFMPEG = jest.fn().mockResolvedValue(undefined);

    // Replace the real implementation of runFFMPEG with our mock
    jest.doMock("../converterWorker", () => {
      const originalModule = jest.requireActual("../converterWorker");
      return {
        ...originalModule,
        runFFMPEG: mockRunFFMPEG,
        // Expose these so we can test them directly
        converterWorker: originalModule.converterWorker,
        runConversion: originalModule.runConversion,
      };
    });
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  it("handles missing input file error", async () => {
    fs.existsSync.mockReturnValue(false);
    const { runConversion } = require("../converterWorker");
    await expect(runConversion()).rejects.toThrow();
  }, 10000);

  it("throws if ffmpeg.exe is not found", async () => {
    // Input file exists but ffmpeg.exe doesn't
    fs.existsSync.mockImplementation((path) => {
      // Return true for the input file, false for ffmpeg.exe
      if (path === "in.wav") return true;
      // Check if path contains ffmpeg.exe
      if (typeof path === "string" && path.includes("ffmpeg.exe")) return false;
      return true;
    });

    // Force NODE_ENV to not be 'test' for this test to trigger ffmpeg check
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const { converterWorker } = require("../converterWorker");

    try {
      await expect(
        converterWorker({
          file: {
            inputFile: "in.wav",
            outputFile: "out.mp3",
            outputFormat: "mp3",
          },
          settings: { oggCodec: "vorbis" },
        })
      ).rejects.toThrow(/ffmpeg\.exe not found/);
    } finally {
      // Restore the NODE_ENV
      process.env.NODE_ENV = originalEnv;
    }
  }, 10000);

  it("fails on non-ASCII output path", async () => {
    fs.existsSync.mockReturnValue(true);
    const { converterWorker } = require("../converterWorker");
    await expect(
      converterWorker({
        file: {
          inputFile: "in.wav",
          outputFile: "out-ü.mp3",
          outputFormat: "mp3",
        },
        settings: { oggCodec: "vorbis" },
      })
    ).rejects.toThrow(/Non-ASCII/);
  }, 10000);

  it("successfully runs the conversion", async () => {
    // Both input file and ffmpeg.exe exist
    fs.existsSync.mockReturnValue(true);

    // Reset mocks to a clean state
    jest.resetModules();
    process.env.NODE_ENV = "test";

    // Create a direct mock for runFFMPEG
    const mockRunFFMPEG = jest.fn().mockResolvedValue(undefined);

    // First, mocking all used modules
    jest.mock("../metaDataService", () => ({
      getMetaData: jest.fn().mockResolvedValue({
        streams: [{ sample_rate: 44100 }],
      }),
      formatMetaData: jest.fn().mockReturnValue({
        metaData: "-metadata title=Test",
        channels: "-ac 2",
      }),
      convertLoopPoints: jest.fn().mockReturnValue({
        newSampleRate: 44100,
        loopStart: null,
        loopLength: null,
      }),
      formatLoopData: jest.fn().mockReturnValue(""),
    }));

    jest.mock("worker_threads", () => ({
      parentPort: { postMessage: jest.fn() },
      workerData: {},
    }));

    jest.mock("fs", () => ({
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
    }));

    jest.mock("path", () => ({
      join: jest.fn((...args) => args.join("/")),
      dirname: jest.fn(() => ""),
    }));

    // Create a spy implementation for the converterWorker module
    const converterWorkerModule = jest.requireActual("../converterWorker");

    // Replace runFFMPEG with our mock
    converterWorkerModule.runFFMPEG = mockRunFFMPEG;

    // Now execute the test
    await converterWorkerModule.converterWorker({
      file: {
        inputFile: "in.wav",
        outputFile: "out.flac",
        outputFormat: "flac",
      },
      settings: { oggCodec: "vorbis" },
    });

    // Verify our mock was called
    expect(mockRunFFMPEG).toHaveBeenCalled();

    // Verify parentPort.postMessage was called
    expect(parentPort.postMessage).toHaveBeenCalledWith({
      type: "code",
      data: 0,
    });
  }, 10000);

  it("handles directory creation error gracefully", async () => {
    // Reset mocks to a clean state
    jest.resetModules();
    process.env.NODE_ENV = "test";

    // Create a direct mock for runFFMPEG
    const mockRunFFMPEG = jest.fn().mockResolvedValue(undefined);

    // Create a mock for mkdirSync that throws an error
    const mockMkdirSync = jest.fn().mockImplementation(() => {
      throw new Error("mkdir error");
    });

    // First, mocking all used modules
    jest.mock("../metaDataService", () => ({
      getMetaData: jest.fn().mockResolvedValue({
        streams: [{ sample_rate: 44100 }],
      }),
      formatMetaData: jest.fn().mockReturnValue({
        metaData: "-metadata title=Test",
        channels: "-ac 2",
      }),
      convertLoopPoints: jest.fn().mockReturnValue({
        newSampleRate: 44100,
        loopStart: null,
        loopLength: null,
      }),
      formatLoopData: jest.fn().mockReturnValue(""),
    }));

    jest.mock("worker_threads", () => ({
      parentPort: { postMessage: jest.fn() },
      workerData: {},
    }));

    jest.mock("fs", () => ({
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: mockMkdirSync,
    }));

    jest.mock("path", () => ({
      join: jest.fn((...args) => args.join("/")),
      dirname: jest.fn(() => "outdir"),
    }));

    // Create a spy implementation for the converterWorker module
    const converterWorkerModule = jest.requireActual("../converterWorker");

    // Replace runFFMPEG with our mock
    converterWorkerModule.runFFMPEG = mockRunFFMPEG;

    // Now execute the test with a format that supports loops
    await converterWorkerModule.converterWorker({
      file: {
        inputFile: "in.wav",
        outputFile: "outdir/out.flac",
        outputFormat: "flac",
      },
      settings: { oggCodec: "vorbis" },
    });

    // Verify mkdirSync was called and threw an error
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockMkdirSync).toHaveBeenCalledWith("outdir", { recursive: true });

    // Verify parentPort.postMessage was called to indicate success despite the error
    expect(parentPort.postMessage).toHaveBeenCalledWith({
      type: "code",
      data: 0,
    });
  }, 10000);

  it("handles runFFMPEG failures", async () => {
    // Reset mocks to a clean state
    jest.resetModules();
    process.env.NODE_ENV = "test";

    // Create a direct mock for runFFMPEG that rejects
    const mockRunFFMPEG = jest.fn().mockImplementation(() => {
      return Promise.reject(new Error("ffmpeg failed"));
    });

    // First, mocking all used modules
    jest.mock("../metaDataService", () => ({
      getMetaData: jest.fn().mockResolvedValue({
        streams: [{ sample_rate: 44100 }],
      }),
      formatMetaData: jest.fn().mockReturnValue({
        metaData: "-metadata title=Test",
        channels: "-ac 2",
      }),
      convertLoopPoints: jest.fn().mockReturnValue({
        newSampleRate: 44100,
        loopStart: null,
        loopLength: null,
      }),
      formatLoopData: jest.fn().mockReturnValue(""),
    }));

    jest.mock("worker_threads", () => ({
      parentPort: {
        postMessage: jest.fn(),
      },
      workerData: {},
    }));

    jest.mock("fs", () => ({
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
    }));

    jest.mock("path", () => ({
      join: jest.fn((...args) => args.join("/")),
      dirname: jest.fn(() => ""),
    }));

    // Create a spy implementation for the fail function
    const mockFail = jest.fn().mockImplementation((reason) => {
      throw new Error(reason);
    });

    // Get the actual module but replace functions
    const converterWorkerModule = jest.requireActual("../converterWorker");
    converterWorkerModule.runFFMPEG = mockRunFFMPEG;
    converterWorkerModule.fail = mockFail;

    // Expect that calling converterWorker will throw an error
    await expect(
      converterWorkerModule.converterWorker({
        file: {
          inputFile: "in.wav",
          outputFile: "out.flac",
          outputFormat: "flac",
        },
        settings: { oggCodec: "vorbis" },
      })
    ).rejects.toThrow();

    // Verify our mock was called
    expect(mockRunFFMPEG).toHaveBeenCalled();

    // Verify that fail was called
    expect(mockFail).toHaveBeenCalled();
  }, 10000);

  it("skips loop points for unsupported formats (WAV and M4A)", async () => {
    // Reset modules
    jest.resetModules();
    process.env.NODE_ENV = "test";

    fs.existsSync.mockReturnValue(true);

    // Mock getMetaData to return valid metadata with loop points
    require("../metaDataService").getMetaData.mockResolvedValue({
      streams: [{ sample_rate: 44100 }],
      format: {
        tags: {
          LOOPSTART: "1000",
          LOOPLENGTH: "10000",
        },
      },
    });

    // Mock formatMetaData
    require("../metaDataService").formatMetaData.mockReturnValue({
      metaData: "-metadata title=Test",
      channels: "-ac 2",
    });

    // Mock convertLoopPoints to return loop data
    require("../metaDataService").convertLoopPoints.mockReturnValue({
      newSampleRate: 44100,
      loopStart: 1000,
      loopLength: 10000,
    });

    // Spy on console.log
    const consoleLogSpy = jest.spyOn(console, "log");

    // Make runFFMPEG resolve successfully
    mockRunFFMPEG = jest.fn().mockResolvedValue(undefined);

    jest.doMock("../converterWorker", () => {
      const originalModule = jest.requireActual("../converterWorker");
      originalModule.runFFMPEG = mockRunFFMPEG;
      return originalModule;
    });

    const { converterWorker } = require("../converterWorker");

    // Test with WAV format
    await converterWorker({
      file: { inputFile: "in.mp3", outputFile: "out.wav", outputFormat: "wav" },
      settings: { oggCodec: "vorbis" },
    });

    // Verify warning was logged for WAV
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Loop points are not supported for WAV format")
    );

    // Clear mocks
    consoleLogSpy.mockClear();

    // Test with M4A format
    await converterWorker({
      file: { inputFile: "in.mp3", outputFile: "out.m4a", outputFormat: "m4a" },
      settings: { oggCodec: "vorbis" },
    });

    // Verify warning was logged for M4A
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Loop points are not supported for M4A format")
    );

    // Cleanup
    consoleLogSpy.mockRestore();
  }, 10000);
});
