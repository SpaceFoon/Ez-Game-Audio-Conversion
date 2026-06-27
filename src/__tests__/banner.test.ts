import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { renderSeaBanner, stripAnsiSgr } from '../banner.js';

describe('banner', () => {
  describe('stripAnsiSgr', () => {
    it('removes simple SGR color sequences', () => {
      expect(stripAnsiSgr('\x1b[31mRed\x1b[0m')).toBe('Red');
    });

    it('preserves plain text without escape codes', () => {
      expect(stripAnsiSgr('EZ Game Audio')).toBe('EZ Game Audio');
    });

    it('handles multiple ANSI sequences on one line', () => {
      expect(stripAnsiSgr('\x1b[1m\x1b[36mTitle\x1b[0m')).toBe('Title');
    });
  });

  describe('renderSeaBanner', () => {
    const originalColumns = process.stdout.columns;

    beforeEach(() => {
      process.stdout.columns = 80;
    });

    afterEach(() => {
      if (originalColumns === undefined) {
        delete (process.stdout as { columns?: number }).columns;
      } else {
        process.stdout.columns = originalColumns;
      }
    });

    it('centers the banner snapshot based on visible width', () => {
      const rendered = renderSeaBanner();
      const lines = rendered.split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^\s+__SEA_BANNER__$/);
      expect(lines[0].length - '__SEA_BANNER__'.length).toBe(
        Math.floor((80 - '__SEA_BANNER__'.length) / 2)
      );
    });

    it('uses 120 columns when stdout width is unavailable', () => {
      delete (process.stdout as { columns?: number }).columns;
      const rendered = renderSeaBanner();
      const line = rendered.split('\n')[0];
      expect(line.length - '__SEA_BANNER__'.length).toBe(
        Math.floor((120 - '__SEA_BANNER__'.length) / 2)
      );
    });

    it('does not add negative padding when the line exceeds terminal width', () => {
      process.stdout.columns = 8;
      const rendered = renderSeaBanner();
      expect(rendered).toBe('__SEA_BANNER__');
    });
  });
});
