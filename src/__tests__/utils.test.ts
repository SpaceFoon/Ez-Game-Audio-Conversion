// src/__tests__/utils.test.js
import { join } from 'path';
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import type { Mock } from 'jest-mock';

// Mock fs module BEFORE importing utils (ESM requirement)
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  openSync: jest.fn(),
  closeSync: jest.fn(),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('chalk', () => ({
  default: {
    red: { bold: jest.fn((text) => text) },
    yellow: jest.fn((text) => text),
    yellowBright: jest.fn((text) => text),
    gray: jest.fn((text) => text),
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
} = await import('fs');

const existsSyncMock = _existsSync as unknown as Mock<
  (path: string) => boolean
>;
const openSyncMock = _openSync as unknown as Mock<
  (path: string, flags: string) => number
>;
const closeSyncMock = _closeSync as unknown as Mock<(fd: number) => void>;
const writeFileSyncMock = _writeFileSync as unknown as Mock<
  (file: string, data: string, options?: unknown) => void
>;
const appendFileSyncMock = _appendFileSync as unknown as Mock<
  (file: string, data: string, options?: unknown) => void
>;

const {
  rl,
  settings,
  initializeFileNames,
  getAnswer,
  getErrorMessage,
  findBinary,
  runtimeBaseDir,
  isFileBusy,
  addToLog,
  __setLogFileStateForTests,
  writeSummaryToLogs,
  recordSearchError,
  getSearchErrors,
  clearSearchErrors,
  reportSearchErrors,
  nextAvailableLogCsvPath,
  escapeCsvField,
  handleExit,
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
    existsSyncMock.mockReset().mockReturnValue(false);
    openSyncMock.mockReset();
    closeSyncMock.mockReset();
    writeFileSyncMock.mockReset();
    appendFileSyncMock.mockReset();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();

    // Mock readline question
    rl.question = jest.fn(
      (_question: string, callback: (answer: string) => void) =>
        callback('test-answer')
    );

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

  it('should have correct structure in settings object', () => {
    expect(settings).toHaveProperty('inputFilePath');
    expect(settings).toHaveProperty('outputFilePath');
    expect(settings).toHaveProperty('inputFormats');
    expect(settings).toHaveProperty('outputFormats');
    expect(settings).toHaveProperty('oggCodec');
  });

  describe('getErrorMessage function', () => {
    it('should unwrap Error instances', () => {
      expect(getErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('should handle non-Error values defensively', () => {
      expect(getErrorMessage('plain failure')).toBe('plain failure');
      expect(getErrorMessage(null)).toBe('Unknown error');
    });
  });

  describe('findBinary function', () => {
    it('should return a binary found directly under runtimeBaseDir', () => {
      const expectedPath = join(runtimeBaseDir, 'ffmpeg.exe');
      existsSyncMock.mockImplementation(
        (path: string) => path === expectedPath
      );

      const result = findBinary('ffmpeg.exe');

      expect(result).toBe(expectedPath);
    });

    it('should fall back to process.cwd subdirectories when runtimeBaseDir misses', () => {
      const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/workspace');
      const expectedPath = join('/workspace', 'dist', 'converterWorker.js');
      existsSyncMock.mockImplementation(
        (path: string) => path === expectedPath
      );

      const result = findBinary('converterWorker.js', ['dist']);

      expect(result).toBe(expectedPath);
      cwdSpy.mockRestore();
    });
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

  describe('isFileBusy function', () => {
    it('should return false if file does not exist', async () => {
      existsSyncMock.mockReturnValueOnce(false);
      const result = await isFileBusy('/test/file.txt');
      expect(result).toBe(false);
    });

    it('should return false if file is not busy', async () => {
      existsSyncMock.mockReturnValueOnce(true);
      openSyncMock.mockReturnValueOnce(123);
      const result = await isFileBusy('/test/file.txt');
      expect(result).toBe(false);
      expect(openSyncMock).toHaveBeenCalledWith('/test/file.txt', 'r+');
      expect(closeSyncMock).toHaveBeenCalledWith(123);
    });

    it('should handle EBUSY error', async () => {
      existsSyncMock.mockReturnValueOnce(true);
      const error = new Error('File is busy') as Error & { code?: string };
      error.code = 'EBUSY';
      openSyncMock.mockImplementationOnce(() => {
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
      expect(existsSyncMock).toHaveBeenCalledWith('/test/output/logs.csv');
      expect(existsSyncMock).toHaveBeenCalledWith('/test/output/error.csv');
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
      existsSyncMock.mockReturnValueOnce(false);

      await addToLog(
        { type: 'code', data: '0' },
        { inputFile: 'input.wav', outputFile: 'output.mp3' }
      );

      expect(writeFileSyncMock).toHaveBeenCalled();
    });

    it('should append to existing log file', async () => {
      // First check if file exists (yes)
      existsSyncMock.mockReturnValueOnce(true);

      await addToLog(
        { type: 'code', data: '0' },
        { inputFile: 'input.wav', outputFile: 'output.mp3' }
      );

      expect(appendFileSyncMock).toHaveBeenCalled();
    });

    it("should create a new error log file when it doesn't exist", async () => {
      // First check if file exists (no)
      existsSyncMock.mockReturnValueOnce(false);

      await addToLog(
        { type: 'stderr', data: 'Test error' },
        { inputFile: 'input.wav', outputFile: 'output.mp3' }
      );

      expect(writeFileSyncMock).toHaveBeenCalled();
    });

    it('should append to existing error log file', async () => {
      // Setup fileNameE
      __setLogFileStateForTests(undefined, '/test/output/error.csv');

      // First check if file exists (yes)
      existsSyncMock.mockReturnValue(true);

      // Ensure appendFileSync is called properly
      appendFileSyncMock.mockImplementation(() => undefined);

      await addToLog(
        { type: 'stderr', data: 'Test error' },
        { inputFile: 'input.wav', outputFile: 'output.mp3' }
      );

      // Now appendFileSync should have been called
      expect(appendFileSyncMock).toHaveBeenCalled();
    });

    it('should return false without throwing when creating the log header fails', async () => {
      existsSyncMock.mockReturnValueOnce(false);
      writeFileSyncMock.mockImplementationOnce(() => {
        throw new Error('header failed');
      });

      await expect(
        addToLog(
          { type: 'code', data: '0' },
          { inputFile: 'input.wav', outputFile: 'output.mp3' }
        )
      ).resolves.toBe(false);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating file or making header')
      );
    });

    it('should return false without throwing when appending the log row fails', async () => {
      existsSyncMock.mockReturnValueOnce(true);
      appendFileSyncMock.mockImplementationOnce(() => {
        throw new Error('append failed');
      });

      await expect(
        addToLog(
          { type: 'code', data: '0' },
          { inputFile: 'input.wav', outputFile: 'output.mp3' }
        )
      ).resolves.toBe(false);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error writing log')
      );
    });
  });

  describe('writeSummaryToLogs function', () => {
    beforeEach(() => {
      // Set up log file paths
      __setLogFileStateForTests(
        '/test/output/logs.csv',
        '/test/output/error.csv'
      );
      jest.clearAllMocks();
    });

    it('should write summary to logs.csv when it exists', () => {
      existsSyncMock.mockReturnValue(true);

      writeSummaryToLogs(100, 95, 5, 123.45);

      expect(appendFileSyncMock).toHaveBeenCalledWith(
        '/test/output/logs.csv',
        expect.stringContaining('SUMMARY:')
      );
    });

    it('should write summary to error.csv when it exists', () => {
      existsSyncMock.mockReturnValue(true);

      writeSummaryToLogs(100, 95, 5, 123.45);

      expect(appendFileSyncMock).toHaveBeenCalledWith(
        '/test/output/error.csv',
        expect.stringContaining('SUMMARY:')
      );
    });

    it('should include total, passed, failed counts in summary', () => {
      existsSyncMock.mockReturnValue(true);

      writeSummaryToLogs(100, 95, 5, 123.45);

      const logCall = appendFileSyncMock.mock.calls.find(
        (call: unknown[]) => call[0] === '/test/output/logs.csv'
      );
      expect(logCall).toBeDefined();
      const csvRow = logCall![1] as string;
      expect(csvRow).toContain('Total=100');
      expect(csvRow).toContain('Passed=95');
      expect(csvRow).toContain('Failed=5');
    });

    it('should include duration in summary with 2 decimal places', () => {
      existsSyncMock.mockReturnValue(true);

      writeSummaryToLogs(50, 50, 0, 45.6789);

      const logCall = appendFileSyncMock.mock.calls.find(
        (call: unknown[]) => call[0] === '/test/output/logs.csv'
      );
      expect(logCall).toBeDefined();
      const csvRow = logCall![1] as string;
      expect(csvRow).toContain('Duration=45.68s');
    });

    it('should format as valid CSV row with empty exit code column', () => {
      existsSyncMock.mockReturnValue(true);

      writeSummaryToLogs(10, 8, 2, 5.0);

      const logCall = appendFileSyncMock.mock.calls.find(
        (call: unknown[]) => call[0] === '/test/output/logs.csv'
      );
      expect(logCall).toBeDefined();
      const csvRow = logCall![1] as string;

      // Should be: timestamp,,summary,\n (empty exit code, empty output)
      // Format: Timestamp,"Exit Code",Input,Output
      const parts = csvRow.split(',');
      expect(parts.length).toBeGreaterThanOrEqual(4);
      expect(parts[1]).toBe(''); // Empty exit code column
      expect(csvRow).toMatch(/\n$/); // Ends with newline
    });

    it('should not write if logs.csv does not exist', () => {
      existsSyncMock.mockReturnValue(false);

      writeSummaryToLogs(10, 10, 0, 1.0);

      // appendFileSync should not be called for non-existent files
      expect(appendFileSyncMock).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      existsSyncMock.mockReturnValue(true);
      appendFileSyncMock.mockImplementationOnce(() => {
        throw new Error('Write failed');
      });

      // Should not throw
      expect(() => writeSummaryToLogs(10, 10, 0, 1.0)).not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error writing summary')
      );
    });

    it('should write to both log files when both exist', () => {
      existsSyncMock.mockReturnValue(true);

      writeSummaryToLogs(20, 15, 5, 10.0);

      // Should append to both files
      expect(appendFileSyncMock).toHaveBeenCalledTimes(2);
      expect(appendFileSyncMock).toHaveBeenCalledWith(
        '/test/output/logs.csv',
        expect.any(String)
      );
      expect(appendFileSyncMock).toHaveBeenCalledWith(
        '/test/output/error.csv',
        expect.any(String)
      );
    });
  });

  describe('search error collection and reporting', () => {
    beforeEach(() => {
      clearSearchErrors();
      settings.outputFilePath = '/test/output';
      __setLogFileStateForTests(null, null);
    });

    it('records, snapshots, and clears search errors', () => {
      recordSearchError(
        '/bad/file.wav',
        new Error('EACCES: permission denied')
      );
      expect(getSearchErrors()).toEqual([
        {
          path: '/bad/file.wav',
          message: 'EACCES: permission denied',
        },
      ]);

      clearSearchErrors();
      expect(getSearchErrors()).toEqual([]);
    });

    it('reportSearchErrors is a no-op when there are no errors', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await reportSearchErrors();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(appendFileSyncMock).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('reportSearchErrors truncates terminal output when more than 20 errors exist', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      existsSyncMock.mockReturnValue(false);

      for (let i = 0; i < 25; i++) {
        recordSearchError(`/locked/track-${i}.wav`, new Error(`error ${i}`));
      }

      await reportSearchErrors();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('25 item(s) could not be read')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('... and 5 more')
      );
      // Each error is written to both error.csv and logs.csv (2 append per entry).
      expect(appendFileSyncMock).toHaveBeenCalledTimes(50);

      warnSpy.mockRestore();
    });

    it('re-checks the file lock after the EBUSY prompt and clears once it is free', async () => {
      existsSyncMock.mockReturnValueOnce(true);
      const error = new Error('EBUSY: resource busy') as Error & {
        code?: string;
      };
      error.code = 'EBUSY';
      // First open: still locked → prompt. Second open: user closed it → free.
      openSyncMock
        .mockImplementationOnce(() => {
          throw error;
        })
        .mockReturnValueOnce(456);

      const result = await isFileBusy('/test/locked.csv');

      expect(rl.question).toHaveBeenCalled();
      // The fix re-opens the file after the prompt instead of trusting the user.
      expect(openSyncMock).toHaveBeenCalledTimes(2);
      expect(result).toBe(false);
    });

    it('reports the file as still busy if it never gets unlocked after repeated prompts', async () => {
      existsSyncMock.mockReturnValue(true);
      const error = new Error('EBUSY: resource busy') as Error & {
        code?: string;
      };
      error.code = 'EBUSY';
      openSyncMock.mockImplementation(() => {
        throw error;
      });

      const result = await isFileBusy('/test/locked.csv');

      expect(result).toBe(true);
      expect(rl.question).toHaveBeenCalled();
    });

    it('reportSearchErrors prints a terminal summary and writes each error to error.csv', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      existsSyncMock.mockReturnValue(false);

      recordSearchError(
        '/locked/track.wav',
        new Error('EBUSY: file is locked')
      );
      await reportSearchErrors();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 item(s) could not be read')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('/locked/track.wav')
      );
      expect(getSearchErrors()).toEqual([]);
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        expect.stringContaining('error.csv'),
        expect.stringContaining('Timestamp'),
        expect.any(Object)
      );
      expect(appendFileSyncMock).toHaveBeenCalledWith(
        expect.stringContaining('error.csv'),
        expect.stringContaining('Unreadable path skipped during search')
      );

      warnSpy.mockRestore();
    });
  });

  describe('handleExit', () => {
    it('throws ExitProgramError with the requested exit code', () => {
      expect(() => handleExit(0)).toThrow(/EXIT_PROGRAM:0/);
      expect(() => handleExit(1)).toThrow(/EXIT_PROGRAM:1/);
    });
  });

  describe('nextAvailableLogCsvPath', () => {
    it('increments when base logs.csv path is already taken', () => {
      const existing = ['/logs/logs.csv'];
      const result = nextAvailableLogCsvPath('/logs', 'logs', (path) =>
        existing.includes(path)
      );
      expect(result.replace(/\\/g, '/')).toBe('/logs/logs(1).csv');
    });
  });

  describe('isFileBusy non-EBUSY errors', () => {
    it('rethrows unexpected filesystem errors after logging', async () => {
      existsSyncMock.mockReturnValueOnce(true);
      const error = new Error('EPERM: operation not permitted') as Error & {
        code?: string;
      };
      error.code = 'EPERM';
      openSyncMock.mockImplementationOnce(() => {
        throw error;
      });

      await expect(isFileBusy('/test/locked.csv')).rejects.toThrow('EPERM');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('escapeCsvField round-trip safety', () => {
    it('wraps values containing commas and preserves content', () => {
      const value = 'hello, "world"';
      const escaped = escapeCsvField(value);
      expect(escaped.startsWith('"')).toBe(true);
      expect(escaped).toContain('hello, ""world""');
    });
  });
});
