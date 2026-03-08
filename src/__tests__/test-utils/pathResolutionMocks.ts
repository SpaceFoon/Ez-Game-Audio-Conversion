export type MockPathSeparator = '/' | '\\';

type FindBinaryMockOptions = {
  sep: MockPathSeparator;
  runtimeBaseDir: string;
  pathExists: (path: string) => boolean;
  includeCwd?: boolean;
  cwdProvider?: () => string;
};

export const joinWithSeparator =
  (sep: MockPathSeparator) =>
  (...parts: string[]): string =>
    parts.join(sep);

export const createFindBinaryMock = ({
  sep,
  runtimeBaseDir,
  pathExists,
  includeCwd = false,
  cwdProvider = () => process.cwd(),
}: FindBinaryMockOptions) => {
  const join = joinWithSeparator(sep);

  return (name: string, subdirs: string[] = []) => {
    const roots = [runtimeBaseDir];

    if (includeCwd) {
      try {
        const cwd = cwdProvider();
        if (cwd) {
          roots.push(cwd);
        }
      } catch {
        /* ignore cwd lookup in tests that intentionally isolate it */
      }
    }

    for (const root of roots) {
      const direct = join(root, name);
      if (pathExists(direct)) {
        return direct;
      }

      for (const sub of subdirs) {
        const candidate = join(root, sub, name);
        if (pathExists(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  };
};
