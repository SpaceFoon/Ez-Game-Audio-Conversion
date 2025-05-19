describe("env.js", () => {
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
  it("sets globalThis.env with default values", () => {
    process.env.NODE_ENV = "";
    process.env.DEBUG = "";
    process.env.PKG_ENV = "";
    require("../env");
    expect(global.env).toBeDefined();
    expect(typeof global.env.isDev).toBe("boolean");
    expect(typeof global.env.isDebug).toBe("boolean");
    expect(typeof global.env.isPkg).toBe("boolean");
    expect(["win32", "darwin", "linux"]).toContain(global.env.platform);
    expect(typeof global.env.cpuCount).toBe("number");
  });
  it("sets isDev and isDebug correctly", () => {
    process.env.NODE_ENV = "dev";
    process.env.DEBUG = "true";
    require("../env");
    expect(global.env.isDev).toBe(true);
    expect(global.env.isDebug).toBe(true);
  });
  // Add more tests for edge cases and platform/arch
});
