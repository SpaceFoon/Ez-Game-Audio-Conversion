// src/__tests__/convertFiles.test.js
const { Worker } = require("worker_threads");
const { convertFiles } = require("../../src/convertFiles");
const { performance } = require("perf_hooks");
const events = require("events");
events.defaultMaxListeners = 20;

// Remove fake timers - they're causing the tests to hang
// jest.useFakeTimers();

// Mock dependencies
jest.mock("perf_hooks", () => ({
  performance: {
    now: jest.fn().mockReturnValue(1000),
  },
}));

jest.mock("worker_threads", () => ({
  Worker: jest.fn(),
}));

jest.mock("chalk", () => ({
  cyanBright: jest.fn((text) => text),
  greenBright: jest.fn((text) => text),
  bgRed: jest.fn((text) => text),
}));

// Create a factory for mocking utils to make it easier to update
const createUtilsMock = (overrides = {}) => ({
  isFileBusy: jest.fn(),
  addToLog: jest.fn(),
  settings: { oggCodec: "vorbis" },
  checkDiskSpace: jest.fn(),
  initializeFileNames: jest.fn(),
  rl: { question: jest.fn((question, callback) => callback()) },
  ...overrides,
});

jest.mock("../../src/utils", () => createUtilsMock());

// Mock os module
jest.mock("os", () => ({
  cpus: jest.fn().mockReturnValue([{}, {}, {}, {}]), // Mock 4 CPUs
}));

// Add a timeout helper function
const withTimeout = (promise, timeoutMs, errorMessage) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      console.error(
        `TIMEOUT: ${errorMessage || "Test took too long to complete"}`
      );
      reject(
        new Error(
          `TIMEOUT: ${errorMessage || "Test took too long to complete"}`
        )
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

describe("convertFiles", () => {
  // Save original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-enable mocking console output since our tests check for these calls
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });

  // Create a factory function for test files to make tests more maintainable
  const createTestFiles = (count = 2) => {
    const files = [];
    for (let i = 0; i < count; i++) {
      files.push({
        inputFile: `C:/Music/testfile${i}.mp3`,
        outputFile: `C:/Music/testfile${i}.ogg`,
        outputFormat: "ogg",
      });
    }
    return files;
  };

  // Enhanced worker mock factory
  function createWorkerMock({
    exitCode = 0,
    triggerError = false,
    triggerStderr = false,
    noSpaceLeft = false,
    delayCompletion = false,
  } = {}) {
    // Mock events object
    const handlers = {};

    // Create a worker with configurable behavior
    const worker = {
      on: jest.fn((event, handler) => {
        handlers[event] = handler;

        // Don't auto-trigger events if we want to delay completion
        if (delayCompletion) {
          return worker;
        }

        // Synchronously trigger events for test cleanliness
        if (event === "message" && handlers.message) {
          if (triggerStderr) {
            const errorMessage = noSpaceLeft
              ? "no space left on device"
              : "Some error from ffmpeg";
            handlers.message({
              type: "stderr",
              data: errorMessage,
            });
            return worker;
          }
          handlers.message({ type: "code", data: exitCode });
        }
        if (event === "error" && handlers.error && triggerError) {
          handlers.error(new Error("Worker thread error"));
        }
        if (event === "exit" && handlers.exit) {
          handlers.exit(exitCode);
        }
        return worker;
      }),
      triggerEvents: () => {
        // No-op, since events are now synchronous
      },
    };
    return worker;
  }

  it("should process files successfully", async () => {
    // Create a simple mock worker that auto-completes successfully
    console.log("Starting 'should process files successfully' test");
    Worker.mockImplementation(() => createWorkerMock({ exitCode: 0 }));

    const result = await withTimeout(
      convertFiles(createTestFiles(2)),
      5000,
      "Test 'should process files successfully' timed out"
    );
    console.log("Test 'should process files successfully' completed");

    expect(Worker).toHaveBeenCalled();
    expect(result.failedFiles).toHaveLength(0);
    expect(result.successfulFiles.length).toBeGreaterThan(0);
  }, 30000);

  it("should handle failed conversions (non-zero exit code)", async () => {
    // Create a worker that exits with non-zero code
    console.log("Starting 'should handle failed conversions' test");
    Worker.mockImplementation(() => createWorkerMock({ exitCode: 1 }));

    const result = await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should handle failed conversions' timed out"
    );
    console.log("Test 'should handle failed conversions' completed");

    expect(Worker).toHaveBeenCalled();
    expect(result.successfulFiles).toHaveLength(0);
    expect(result.failedFiles.length).toBeGreaterThan(0);
    expect(console.error).toHaveBeenCalled();
  }, 30000);

  it("should handle worker errors", async () => {
    // Mock a worker that triggers an error
    console.log("Starting 'should handle worker errors' test");

    Worker.mockImplementation(() => {
      // Synchronously fire the error event when registered
      const handlers = {};
      const worker = {
        on: jest.fn((event, handler) => {
          handlers[event] = handler;
          if (event === "error") {
            handler(new Error("Worker thread error"));
          }
          return worker;
        }),
      };
      return worker;
    });

    await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should handle worker errors' timed out"
    );
    console.log("Test 'should handle worker errors' completed");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Worker had an error"),
      expect.any(String),
      expect.any(String)
    );
  }, 30000);

  it("should handle stderr messages from workers", async () => {
    // Mock a worker that sends stderr messages
    console.log("Starting 'should handle stderr messages from workers' test");

    Worker.mockImplementation(() =>
      createWorkerMock({
        triggerStderr: true,
      })
    );

    await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should handle stderr messages from workers' timed out"
    );
    console.log("Test 'should handle stderr messages from workers' completed");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("ERROR MESSAGE FROM FFMPEG"),
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
  }, 30000);

  it("should detect disk space errors and exit the process", async () => {
    // Mock a worker that sends a 'no space left' error
    console.log("Starting 'should detect disk space errors' test");

    Worker.mockImplementation(() =>
      createWorkerMock({
        triggerStderr: true,
        noSpaceLeft: true,
      })
    );

    // Mock process.exit
    const originalExit = process.exit;
    process.exit = jest.fn();

    await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should detect disk space errors' timed out"
    );
    console.log("Test 'should detect disk space errors' completed");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Stopping due to insufficient disk space")
    );

    // Restore process.exit
    process.exit = originalExit;
  }, 30000);

  it("should handle multiple workers and files properly", async () => {
    // Create a mix of successful and failing workers
    console.log(
      "Starting 'should handle multiple workers and files properly' test"
    );

    let callCount = 0;
    Worker.mockImplementation(() => {
      callCount++;
      return createWorkerMock({
        exitCode: callCount % 2 === 0 ? 0 : 1,
      });
    });

    const result = await withTimeout(
      convertFiles(createTestFiles(4)),
      5000,
      "Test 'should handle multiple workers and files' timed out"
    );
    console.log(
      "Test 'should handle multiple workers and files properly' completed"
    );

    expect(Worker).toHaveBeenCalledTimes(4);
    expect(result.successfulFiles.length).toBeGreaterThan(0);
    expect(result.failedFiles.length).toBeGreaterThan(0);
  }, 30000);

  // Test for CPU count fallback
  it("should handle CPU detection failure", async () => {
    // Mock os.cpus to throw an error
    console.log("Starting 'should handle CPU detection failure' test");

    require("os").cpus.mockImplementationOnce(() => {
      throw new Error("CPU detection failed");
    });

    Worker.mockImplementation(() => createWorkerMock({ exitCode: 0 }));

    const result = await withTimeout(
      convertFiles(createTestFiles(2)),
      5000,
      "Test 'should handle CPU detection failure' timed out"
    );
    console.log("Test 'should handle CPU detection failure' completed");

    // Update to match the actual format of the warning
    expect(console.warn).toHaveBeenCalledWith(
      "🚨🚨⛔ Could not detect amount of CPU cores!!! Setting to 8 ⛔🚨🚨"
    );
    expect(result.failedFiles).toHaveLength(0);
  }, 30000);

  it("should limit concurrent workers based on CPU count and file count", async () => {
    // Set up 10 CPUs but only 2 files
    console.log("Starting 'should limit concurrent workers' test");

    require("os").cpus.mockReturnValueOnce(Array(10).fill({}));
    Worker.mockImplementation(() => createWorkerMock({ exitCode: 0 }));

    await withTimeout(
      convertFiles(createTestFiles(2)),
      5000,
      "Test 'should limit concurrent workers' timed out"
    );
    console.log("Test 'should limit concurrent workers' completed");

    expect(Worker).toHaveBeenCalledTimes(2); // Should create only 2 workers
  }, 30000);

  it("should properly handle worker creation errors", async () => {
    // Mock Worker constructor to throw an error
    console.log(
      "Starting 'should properly handle worker creation errors' test"
    );

    Worker.mockImplementationOnce(() => {
      throw new Error("Failed to create worker");
    });

    // Should not throw but log the error
    await withTimeout(
      convertFiles(createTestFiles(1)),
      5000,
      "Test 'should properly handle worker creation errors' timed out"
    );
    console.log(
      "Test 'should properly handle worker creation errors' completed"
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error creating worker"),
      expect.any(Object)
    );
  }, 30000);

  it("should handle an empty file list", async () => {
    Worker.mockImplementation(() => createWorkerMock({ exitCode: 0 }));
    const result = await withTimeout(
      convertFiles([]),
      5000,
      "Test 'should handle empty file list' timed out"
    );
    expect(result.failedFiles).toHaveLength(0);
    expect(result.successfulFiles).toHaveLength(0);
  });

  it("should handle file with missing properties gracefully", async () => {
    Worker.mockImplementation(() => createWorkerMock({ exitCode: 0 }));
    const files = [
      { inputFile: undefined, outputFile: undefined, outputFormat: undefined },
    ];
    const result = await withTimeout(
      convertFiles(files),
      5000,
      "Test 'should handle file with missing properties' timed out"
    );
    expect(result.failedFiles.length + result.successfulFiles.length).toBe(1);
  });

  it("should put all files in failedFiles if all workers fail", async () => {
    Worker.mockImplementation(() => createWorkerMock({ exitCode: 1 }));
    const files = createTestFiles(3);
    const result = await withTimeout(
      convertFiles(files),
      5000,
      "Test 'should put all files in failedFiles' timed out"
    );
    expect(result.failedFiles.length).toBe(3);
    expect(result.successfulFiles).toHaveLength(0);
  });
});
