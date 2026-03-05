import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';

type PathStyle = 'posix' | 'win32';

type SetupOptions = {
  pathStyle: PathStyle;
  isPackagedRuntime: boolean;
};

const makeJoin = (style: PathStyle) => {
  const sep = style === 'win32' ? '\\' : '/';
  return (...parts: string[]) => parts.join(sep);
};

async function setupAndImportConverterManager(options: SetupOptions) {
  jest.resetModules();

  // Keep output quiet in tests.
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();

  const join = makeJoin(options.pathStyle);
  const moduleDir = options.pathStyle === 'win32' ? 'C:\\MODDIR' : '/MODDIR';
  const cwdDir = options.pathStyle === 'win32' ? 'C:\\CWD' : '/CWD';
  const runtimeBaseDir =
    options.pathStyle === 'win32' ? 'C:\\RUNTIME' : '/RUNTIME';

  const existsSyncMock = jest.fn((_p: string) => false);
  const createdWorkerPaths: string[] = [];

  jest.unstable_mockModule('fs', () => ({
    existsSync: existsSyncMock,
  }));

  jest.unstable_mockModule('os', () => ({
    cpus: jest.fn(() => new Array(4).fill({})),
  }));

  jest.unstable_mockModule('chalk', () => ({
    default: {
      cyanBright: jest.fn((s: string) => s),
      greenBright: jest.fn((...s: any[]) => s.join(' ')),
      red: jest.fn((s: string) => s),
    },
  }));

  jest.unstable_mockModule('path', () => ({
    join: jest.fn((...parts: string[]) => join(...parts)),
    dirname: jest.fn((_p: string) => moduleDir),
  }));

  jest.unstable_mockModule('worker_threads', () => {
    class MockWorker extends EventEmitter {
      constructor(workerPath: string) {
        super();
        createdWorkerPaths.push(workerPath);
        setImmediate(() => {
          this.emit('message', { type: 'code', data: 0 });
        });
      }
    }

    return {
      Worker: MockWorker,
    };
  });

  jest.unstable_mockModule('../utils.js', () => ({
    initializeFileNames: jest.fn(),
    addToLog: jest.fn(),
    settings: {
      outputFilePath: cwdDir,
      oggCodec: 'vorbis',
    },
    getAnswer: jest.fn(async () => ''),
    runtimeBaseDir,
    isPackagedRuntime: options.isPackagedRuntime,
    findBinary: (name: string, subdirs: string[] = []) => {
      const roots = [runtimeBaseDir, cwdDir];
      for (const root of roots) {
        const direct = join(root, name);
        if (existsSyncMock(direct)) return direct;
        for (const sub of subdirs) {
          const candidate = join(root, sub, name);
          if (existsSyncMock(candidate)) return candidate;
        }
      }
      return null;
    },
  }));

  const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(cwdDir);

  try {
    const { convertFiles } = await import('../converterManager.js');
    return {
      convertFiles,
      existsSyncMock,
      createdWorkerPaths,
      join,
      moduleDir,
      cwdDir,
      runtimeBaseDir,
      cleanup: () => cwdSpy.mockRestore(),
    };
  } catch (e) {
    cwdSpy.mockRestore();
    throw e;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('converterManager worker path resolution', () => {
  it('dev + linux paths: prefers runtimeBaseDir/dist worker', async () => {
    const env = await setupAndImportConverterManager({
      pathStyle: 'posix',
      isPackagedRuntime: false,
    });

    // findBinary('converterWorker.js', ['dist']) checks:
    // runtimeBaseDir/converterWorker.js, runtimeBaseDir/dist/converterWorker.js,
    // cwdDir/converterWorker.js, cwdDir/dist/converterWorker.js
    const expectedPath = env.join(
      env.runtimeBaseDir,
      'dist',
      'converterWorker.js'
    );

    env.existsSyncMock.mockImplementation((p: string) => p === expectedPath);

    await env.convertFiles([
      {
        inputFile: 'in.wav',
        outputFile: 'out.mp3',
        outputFormat: 'mp3',
      },
    ]);

    expect(env.createdWorkerPaths[0]).toBe(expectedPath);

    env.cleanup();
  });

  it('dev + windows paths: falls back to cwd dist worker', async () => {
    const env = await setupAndImportConverterManager({
      pathStyle: 'win32',
      isPackagedRuntime: false,
    });

    const expectedPath = env.join(env.cwdDir, 'dist', 'converterWorker.js');

    env.existsSyncMock.mockImplementation((p: string) => p === expectedPath);

    await env.convertFiles([
      {
        inputFile: 'in.wav',
        outputFile: 'out.mp3',
        outputFormat: 'mp3',
      },
    ]);

    expect(env.createdWorkerPaths[0]).toBe(expectedPath);

    env.cleanup();
  });

  it('prod(packaged) + linux paths: prefers runtimeBaseDir/dist worker', async () => {
    const env = await setupAndImportConverterManager({
      pathStyle: 'posix',
      isPackagedRuntime: true,
    });

    const expectedPath = env.join(
      env.runtimeBaseDir,
      'dist',
      'converterWorker.cjs'
    );

    env.existsSyncMock.mockImplementation((p: string) => p === expectedPath);

    await env.convertFiles([
      {
        inputFile: 'in.wav',
        outputFile: 'out.mp3',
        outputFormat: 'mp3',
      },
    ]);

    expect(env.createdWorkerPaths[0]).toBe(expectedPath);

    env.cleanup();
  });

  it('prod(packaged) + windows paths: prefers runtimeBaseDir/dist worker', async () => {
    const env = await setupAndImportConverterManager({
      pathStyle: 'win32',
      isPackagedRuntime: true,
    });

    const expectedPath = env.join(
      env.runtimeBaseDir,
      'dist',
      'converterWorker.cjs'
    );

    env.existsSyncMock.mockImplementation((p: string) => p === expectedPath);

    await env.convertFiles([
      {
        inputFile: 'in.wav',
        outputFile: 'out.mp3',
        outputFormat: 'mp3',
      },
    ]);

    expect(env.createdWorkerPaths[0]).toBe(expectedPath);

    env.cleanup();
  });

  it('throws a helpful error when no worker candidate exists', async () => {
    const env = await setupAndImportConverterManager({
      pathStyle: 'posix',
      isPackagedRuntime: true,
    });

    env.existsSyncMock.mockReturnValue(false);

    await env.convertFiles([
      {
        inputFile: 'in.wav',
        outputFile: 'out.mp3',
        outputFormat: 'mp3',
      },
    ]);

    const allConsoleErrorText = (
      console.error as unknown as jest.Mock
    ).mock.calls
      .flat()
      .join(' ');
    expect(allConsoleErrorText).toMatch(
      /Worker file converterWorker\.cjs not found/
    );

    env.cleanup();
  });
});
