import { jest } from '@jest/globals';

/** Default fs mock for createConversionList tests (empty output tree). */
export const createConversionListFsMock = () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => [] as string[]),
  statSync: jest.fn(() => ({ isDirectory: () => false })),
});

/** Simulate existing output files in a flat directory for conflict tests. */
export function mockExistingFilesInDir(
  readdirSync: jest.Mock,
  statSync: jest.Mock,
  dirPath: string,
  fileNames: string[]
): void {
  readdirSync.mockImplementation((dir: string) => {
    if (String(dir) === dirPath) return fileNames;
    return [];
  });
  statSync.mockImplementation(() => ({
    isDirectory: () => false,
  }));
}
