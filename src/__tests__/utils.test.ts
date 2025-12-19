// src/__tests__/utils.test.js
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock fs module BEFORE importing utils (ESM requirement)
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  openSync: jest.fn(),
  closeSync: jest.fn(),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  statSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => ({
  default: {
    red: { bold: jest.fn((text) => text) },
    yellow: { bold: jest.fn((text) => text) },
    redBright: jest.fn((text) => text),
  },
}));

jest.unstable_mockModule('moment', () => ({
  default: jest.fn(() => ({
    format: jest.fn(() => '01-01-2023 12:00:00'),
  })),
}));

// Now import the mocked fs and the module under test
const {
  existsSync: _existsSync,
  openSync: _openSync,
  closeSync: _closeSync,
  writeFileSync: _writeFileSync,
  appendFileSync: _appendFileSync,
  statSync: _statSync,
} = await import('fs');

const {
  rl,
  settings,
  initializeFileNames,
  getAnswer,
  isFileBusy,
  addToLog,
  checkDiskSpace,
  __setLogFileStateForTests,
} = await import('../utils.js');

describe('utils module', () => {
  // Capture original console implementation
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  // Original functions that we'll restore in afterEach
  const origReadline = rl.question;
  // const origConsoleError = utils.originalConsoleError; // Unused
  // const origConsoleWarn = utils.originalConsolWarn; // Unused

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();

    // Mock readline question
    rl.question = jest.fn((_, callback) => callback('test-answer'));

    // Setup internal log files
    __setLogFileStateForTests(
      '/test/output/logs.csv',
      '/test/output/error.csv'
    );
  });

  afterEach(() => {
    // Restore original console and readline
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    rl.question = origReadline;
  });

  it('should export expected functions and objects', () => {
    expect(settings).toBeDefined();
    expect(typeof initializeFileNames).toBe('function');
    expect(typeof getAnswer).toBe('function');
    expect(typeof isFileBusy).toBe('function');
    expect(typeof addToLog).toBe('function');
    expect(typeof checkDiskSpace).toBe('function');
  });

  it('should have correct structure in settings object', () => {
    expect(settings).toHaveProperty('inputFilePath');
    expect(settings).toHaveProperty('outputFilePath');
    expect(settings).toHaveProperty('inputFormats');
    expect(settings).toHaveProperty('outputFormats');
    expect(settings).toHaveProperty('oggCodec');
  });

  describe('getAnswer function', () => {
    it('should return a promise that resolves with user input', async () => {
      const answer = await getAnswer('Test question');
      expect(answer).toBe('test-answer');
      // getAnswer logs the question and calls rl.question with empty string
      expect(console.log).toHaveBeenCalledWith('Test question');
      expect(rl.question).toHaveBeenCalledWith('', expect.any(Function));
    });

    it('should handle array inputs (from chalk)', async () => {
      const answer = await getAnswer(['Test', 'question']);
      expect(answer).toBe('test-answer');
      // Arrays are joined with space
      expect(console.log).toHaveBeenCalledWith('Test question');
      expect(rl.question).toHaveBeenCalledWith('', expect.any(Function));
    });
  });

  describe('checkDiskSpace function', () => {
    it('should return true when disk space check succeeds', () => {
      _statSync.mockReturnValueOnce({ isFile: () => false });
      expect(checkDiskSpace('/test/dir')).toBe(true);
      expect(_statSync).toHaveBeenCalledWith('/test/dir');
    });

    it('should return true when directory is not provided', () => {
      // When no directory provided, it warns and returns true without calling statSync
      expect(checkDiskSpace()).toBe(true);
      expect(console.warn).toHaveBeenCalled();
      expect(_statSync).not.toHaveBeenCalled();
    });

    it('should return true even when errors occur (fail-safe)', () => {
      _statSync.mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      expect(checkDiskSpace('/test/dir')).toBe(true);
      // Error is logged but returns true anyway
    });
  });

  describe('isFileBusy function', () => {
    it('should return false if file does not exist', async () => {
      _existsSync.mockReturnValueOnce(false);
      const result = await isFileBusy('/test/file.txt');
      expect(result).toBe(false);
    });

    it('should return false if file is not busy', async () => {
      _existsSync.mockReturnValueOnce(true);
      _openSync.mockReturnValueOnce(123);
      const result = await isFileBusy('/test/file.txt');
      expect(result).toBe(false);
      expect(_openSync).toHaveBeenCalledWith('/test/file.txt', 'r+');
      expect(_closeSync).toHaveBeenCalledWith(123);
    });

    it('should handle EBUSY error', async () => {
      _existsSync.mockReturnValueOnce(true);
      const error = new Error('File is busy');
      error.code = 'EBUSY';
      _openSync.mockImplementationOnce(() => {
        throw error;
      });

      // Create a promise that resolves after a short delay to handle the async question
      const promise = isFileBusy('/test/file.txt');

      // We need to wait a tick to allow the async callback to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(rl.question).toHaveBeenCalled();
      await promise;
    });
  });

  describe('initializeFileNames function', () => {
    it('should initialize file names for logs and errors', () => {
      settings.outputFilePath = '/test/output';
      initializeFileNames();
      // Verify calls to existsSync
      expect(_existsSync).toHaveBeenCalledWith('/test/output/logs.csv');
      expect(_existsSync).toHaveBeenCalledWith('/test/output/error.csv');
    });
  });

  describe('addToLog function', () => {
    beforeEach(() => {
      // Set up test environment
      settings.outputFilePath = '/test/output';
      initializeFileNames();

      // Reset mocks after initializeFileNames has been called
      jest.clearAllMocks();
    });

    it("should create a new log file when it doesn't exist", async () => {
      // First check if file exists (no)
      _existsSync.mockReturnValueOnce(false);

      await addToLog(
        { type: 'code', data: '0' },
        { inputFile: 'input.wav', outputFile: 'output.mp3' },
        0
      );

      expect(_writeFileSync).toHaveBeenCalled();
    });

    it('should append to existing log file', async () => {
      // First check if file exists (yes)
      _existsSync.mockReturnValueOnce(true);

      await addToLog(
        { type: 'code', data: '0' },
        { inputFile: 'input.wav', outputFile: 'output.mp3' },
        0
      );

      expect(_appendFileSync).toHaveBeenCalled();
    });

    it("should create a new error log file when it doesn't exist", async () => {
      // First check if file exists (no)
      _existsSync.mockReturnValueOnce(false);

      await addToLog(
        { type: 'stderr', data: 'Test error' },
        { inputFile: 'input.wav', outputFile: 'output.mp3' },
        0
      );

      expect(_writeFileSync).toHaveBeenCalled();
    });

    it('should append to existing error log file', async () => {
      // Setup fileNameE
      __setLogFileStateForTests(undefined, '/test/output/error.csv');

      // First check if file exists (yes)
      _existsSync.mockReturnValue(true);

      // Ensure appendFileSync is called properly
      _appendFileSync.mockImplementation(() => true);

      await addToLog(
        { type: 'stderr', data: 'Test error' },
        { inputFile: 'input.wav', outputFile: 'output.mp3' },
        0
      );

      // Now appendFileSync should have been called
      expect(_appendFileSync).toHaveBeenCalled();
    });
  });
});
