import { describe, expect, it } from '@jest/globals';
import { isNewerVersion } from '../updateCheck.js';

describe('isNewerVersion', () => {
  it('detects a newer patch release', () => {
    expect(isNewerVersion('1.8.1', '1.8.0')).toBe(true);
  });

  it('detects a newer minor release', () => {
    expect(isNewerVersion('1.10.0', '1.9.9')).toBe(true);
  });

  it('accepts tags prefixed with v', () => {
    expect(isNewerVersion('v2.0.0', '1.9.9')).toBe(true);
  });

  it('does not report the same version as newer', () => {
    expect(isNewerVersion('1.8.0', '1.8.0')).toBe(false);
  });

  it('does not report an older release as newer', () => {
    expect(isNewerVersion('1.5.1', '1.8.0')).toBe(false);
  });
});
