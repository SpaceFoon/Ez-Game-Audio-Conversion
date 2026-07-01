import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('package.json audit characterizations', () => {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8')
  ) as {
    scripts?: Record<string, string>;
    jest?: {
      forceExit?: boolean;
      collectCoverageFrom?: string[];
      coverageReporters?: string[];
    };
  };

  it('keeps jest forceExit enabled in the checked-in config', () => {
    expect(packageJson.jest?.forceExit).toBe(true);
  });

  it('collects coverage from production source only', () => {
    expect(packageJson.jest?.collectCoverageFrom).toEqual(
      expect.arrayContaining([
        'src/**/*.ts',
        '!src/**/__tests__/**',
        '!src/types/**',
        '!src/ico/**',
      ])
    );
  });

  it('emits json-summary coverage for CI artifacts', () => {
    expect(packageJson.jest?.coverageReporters).toEqual(
      expect.arrayContaining(['json-summary', 'lcov', 'text'])
    );
  });

  it('defines split test scripts for local and release workflows', () => {
    expect(packageJson.scripts?.['test:unit']).toContain(
      'testPathIgnorePatterns'
    );
    expect(packageJson.scripts?.['test:integration']).toContain('integration/');
    expect(packageJson.scripts?.['test:pre-release']).toContain('test:unit');
    expect(packageJson.scripts?.['test:pre-release']).toContain(
      'test:property'
    );
    expect(packageJson.scripts?.['test:pre-release']).toContain('test:smoke');
  });
});
