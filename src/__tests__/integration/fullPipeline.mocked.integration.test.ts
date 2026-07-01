import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

let scriptedAnswers: string[] = [];

const mockedSettings = {
  inputFilePath: '',
  outputFilePath: '',
  inputFormats: [],
  outputFormats: [],
  oggCodec: null,
  singleFileMode: false,
  singleFilePath: '',
  loopDataMode: 'auto',
};

jest.unstable_mockModule('../../utils.js', () => ({
  settings: mockedSettings,
  isSeaRuntime: false,
  isPackagedRuntime: false,
  runtimeBaseDir: '/mock/base',
  getAnswer: jest.fn(async () => {
    const next = scriptedAnswers.shift();
    if (typeof next === 'undefined') {
      throw new Error('Unexpected prompt without a scripted answer');
    }
    return next;
  }),
  initializeFileNames: jest.fn(),
  addToLog: jest.fn(async () => true),
  isFileBusy: jest.fn(async () => false),
  writeSummaryToLogs: jest.fn(),
  recordSearchError: jest.fn(),
  getSearchErrors: jest.fn(() => []),
  clearSearchErrors: jest.fn(),
  reportSearchErrors: jest.fn(async () => {}),
  findBinary: jest.fn(() => '/mock/base/converterWorker.js'),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error || 'Unknown error'),
  handleExit: jest.fn((code: number = 0) => {
    throw new Error(`Unexpected handleExit(${code}) during full pipeline test`);
  }),
  rl: {
    question: jest.fn((_prompt: string, callback: (answer: string) => void) =>
      callback('q')
    ),
    close: jest.fn(),
  },
}));

jest.unstable_mockModule('worker_threads', () => ({
  Worker: jest.fn(() => {
    const handlers: {
      message?: (message: unknown) => void;
      error?: (error: unknown) => void;
      exit?: (code: number) => void;
    } = {};

    const worker = {
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'message') {
          handlers.message = handler as (message: unknown) => void;
          handlers.message({ type: 'code', data: 0 });
        }
        if (event === 'error') {
          handlers.error = handler as (error: unknown) => void;
        }
        if (event === 'exit') {
          handlers.exit = handler as (code: number) => void;
          handlers.exit(0);
        }
        return worker;
      }),
    };

    return worker;
  }),
}));

jest.unstable_mockModule('perf_hooks', () => ({
  performance: {
    now: jest.fn(() => 1000),
  },
}));

jest.unstable_mockModule('dotenv', () => ({
  config: jest.fn(),
  default: { config: jest.fn() },
}));

jest.unstable_mockModule('cfonts', () => ({
  default: { say: jest.fn() },
  say: jest.fn(),
}));

jest.unstable_mockModule('os', () => ({
  default: {
    platform: jest.fn(() => 'win32'),
    arch: jest.fn(() => 'x64'),
    cpus: jest.fn(() => [{}, {}, {}, {}]),
    release: jest.fn(() => 'test'),
  },
  platform: jest.fn(() => 'win32'),
  arch: jest.fn(() => 'x64'),
  cpus: jest.fn(() => [{}, {}, {}, {}]),
  release: jest.fn(() => 'test'),
}));

const { default: runApp } = await import('../../app.js');
const { Worker } = await import('worker_threads');
const { getAnswer, addToLog, writeSummaryToLogs, rl, settings } =
  await import('../../utils.js');

describe('full mocked pipeline integration', () => {
  const originalArgv = [...process.argv];
  const originalEnv = globalThis.env;
  const testRoot = join(
    process.cwd(),
    '.tmp-tests',
    `full-pipeline-${Date.now()}`
  );
  const inputFile = join(testRoot, 'song.wav');
  const expectedOutputFile = join(testRoot, 'song.mp3');

  beforeEach(() => {
    jest.clearAllMocks();
    scriptedAnswers = ['', 'wav', 'mp3', 'yes'];

    mockedSettings.inputFilePath = '';
    mockedSettings.outputFilePath = '';
    mockedSettings.inputFormats = [];
    mockedSettings.outputFormats = [];
    mockedSettings.oggCodec = null;
    mockedSettings.singleFileMode = false;
    mockedSettings.singleFilePath = '';
    mockedSettings.loopDataMode = 'auto';

    mkdirSync(testRoot, { recursive: true });
    writeFileSync(inputFile, 'fake wav payload');
    process.argv = [originalArgv[0], originalArgv[1], testRoot];
    delete (globalThis as { env?: unknown }).env;

    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    if (typeof originalEnv === 'undefined') {
      delete (globalThis as { env?: unknown }).env;
    } else {
      globalThis.env = originalEnv;
    }
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('runs the real pipeline from user input through finalize with mocked worker success', async () => {
    await runApp();

    expect(getAnswer).toHaveBeenCalledTimes(4);
    expect(settings.inputFilePath).toBe(testRoot);
    expect(settings.outputFilePath).toBe(testRoot);
    expect(settings.inputFormats).toEqual(['wav']);
    expect(settings.outputFormats).toEqual(['mp3']);

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenCalledWith('/mock/base/converterWorker.js', {
      workerData: {
        file: {
          inputFile,
          outputFile: expectedOutputFile,
          outputFormat: 'mp3',
        },
        settings: {
          oggCodec: 'vorbis',
          loopDataMode: 'auto',
        },
      },
    });

    expect(addToLog).toHaveBeenCalledWith(
      { type: 'code', data: 0 },
      {
        inputFile,
        outputFile: expectedOutputFile,
        outputFormat: 'mp3',
      }
    );

    expect(writeSummaryToLogs).toHaveBeenCalledWith(
      1,
      1,
      0,
      expect.any(Number)
    );
    expect(rl.question).toHaveBeenCalledTimes(1);
    expect(rl.close).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Fatal Error')
    );
  });

  it('calls reportSearchErrors during finalize when search errors were recorded', async () => {
    const { getSearchErrors, reportSearchErrors } =
      await import('../../utils.js');
    (getSearchErrors as jest.Mock).mockReturnValueOnce([
      {
        path: join(testRoot, 'locked.wav'),
        message: 'EACCES: permission denied',
      },
    ]);

    await runApp();

    expect(reportSearchErrors).toHaveBeenCalled();
  });
});
