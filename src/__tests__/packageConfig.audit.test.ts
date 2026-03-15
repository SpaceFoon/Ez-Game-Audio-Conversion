import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('package.json audit characterizations', () => {
  it('keeps jest forceExit enabled in the checked-in config', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    ) as {
      jest?: {
        forceExit?: boolean;
      };
    };

    expect(packageJson.jest?.forceExit).toBe(true);
  });
});
