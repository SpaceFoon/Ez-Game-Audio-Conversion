// src/__tests__/convertFiles.test.js
const { Worker } = require("worker_threads");
const chalk = require("chalk");
const { convertFiles } = require("../convertFiles");
const { isFileBusy, addToLog, settings, checkDiskSpace } = require("../utils");

// Mock dependencies
jest.mock("worker_threads", () => ({
  Worker: jest.fn(),
}));
jest.mock("chalk", () => ({
  cyanBright: jest.fn((text) => text),
}));
jest.mock("../utils", () => ({
  isFileBusy: jest.fn(),
  addToLog: jest.fn(),
  settings: jest.fn(),
  checkDiskSpace: jest.fn(),
}));

describe("convertFiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockFiles = [
    {
      inputFile: "C:/Music/01 sh33n4 1s 4 b1t r0ck3r ( Ramones.mp3",
      outputFile: "C:/Music/01 sh33n4 1s 4 b1t r0ck3r ( Ramones.ogg",
    },
    {
      inputFile: "C:/Music/01 Intro_attribution.mp3",
      outputFile: "C:/Music/01 Intro_attribution.ogg",
    },
  ];

  it("should process files successfully", async () => {
    Worker.mockImplementation(() => ({
      on: (event, callback) => {
        if (event === "message") {
          callback({ type: "code", data: 0 });
        }
      },
    }));

    const result = await convertFiles(mockFiles);
    expect(result.failedFiles.length).toBe(0);
    expect(result.successfulFiles.length).toBe(2);
    expect(addToLog).toHaveBeenCalledTimes(2);
  });

  it("should handle worker errors", async () => {
    Worker.mockImplementation(() => ({
      on: (event, callback) => {
        if (event === "message") {
          console.log("Simulating worker error message");
          callback({ type: "error", data: "Error message" });
        }
        if (event === "exit") {
          console.log("Simulating worker exit");
          callback(1); // Simulate worker exit with error code
        }
      },
      postMessage: jest.fn(),
    }));

    const result = await convertFiles(mockFiles);
    console.log("Result:", result);
    console.log("Failed Files:", result.failedFiles);
    console.log("Successful Files:", result.successfulFiles);
    expect(result.failedFiles.length).toBe(2); // Expecting both files to fail
    expect(result.successfulFiles.length).toBe(0);
    expect(addToLog).toHaveBeenCalledTimes(2);
  });
});
