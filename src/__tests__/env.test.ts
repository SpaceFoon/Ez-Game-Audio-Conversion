import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

describe('env.js', () => {
  let originalEnv: typeof globalThis.env | undefined;
  
  beforeEach(() => {
    jest.resetModules();
    originalEnv = globalThis.env;
    delete (globalThis as { env?: typeof globalThis.env }).env;
  });
  
  afterEach(() => {
    process.env = { ...process.env };
    if (originalEnv) {
      globalThis.env = originalEnv;
    } else {
      delete (globalThis as { env?: typeof globalThis.env }).env;
    }
  });
  
  it('sets globalThis.env with default values', async () => {
    process.env.NODE_ENV = '';
    process.env.DEBUG = '';
    process.env.PKG_ENV = '';
    await import('../env.js');
    expect(globalThis.env).toBeDefined();
    expect(typeof globalThis.env.isDev).toBe('boolean');
    expect(typeof globalThis.env.isDebug).toBe('boolean');
    expect(typeof globalThis.env.isPkg).toBe('boolean');
    expect(['win32', 'darwin', 'linux']).toContain(globalThis.env.platform);
    expect(typeof globalThis.env.cpuCount).toBe('number');
  });
  
  it('sets isDev and isDebug correctly', async () => {
    process.env.NODE_ENV = 'dev';
    process.env.DEBUG = 'true';
    await import('../env.js');
    expect(globalThis.env.isDev).toBe(true);
    expect(globalThis.env.isDebug).toBe(true);
  });
});
