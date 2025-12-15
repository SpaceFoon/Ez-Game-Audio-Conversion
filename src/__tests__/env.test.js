import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

describe('env.js', () => {
  let originalEnv;
  beforeEach(() => {
    jest.resetModules();
    originalEnv = { ...process.env };
    delete global.env;
  });
  afterEach(() => {
    process.env = originalEnv;
    delete global.env;
  });
  it('sets globalThis.env with default values', async () => {
    process.env.NODE_ENV = '';
    process.env.DEBUG = '';
    process.env.PKG_ENV = '';
    await import('../env.js');
    expect(global.env).toBeDefined();
    expect(typeof global.env.isDev).toBe('boolean');
    expect(typeof global.env.isDebug).toBe('boolean');
    expect(typeof global.env.isPkg).toBe('boolean');
    expect(['win32', 'darwin', 'linux']).toContain(global.env.platform);
    expect(typeof global.env.cpuCount).toBe('number');
  });
  it('sets isDev and isDebug correctly', async () => {
    process.env.NODE_ENV = 'dev';
    process.env.DEBUG = 'true';
    await import('../env.js');
    expect(global.env.isDev).toBe(true);
    expect(global.env.isDebug).toBe(true);
  });
  // Add more tests for edge cases and platform/arch
});
