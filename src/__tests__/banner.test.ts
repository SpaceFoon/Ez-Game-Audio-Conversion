import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { stripAnsiSgr, renderSeaBanner } from '../banner.js';

describe('banner', () => {
  const originalColumns = process.stdout.columns;

  beforeEach(() => {
    process.stdout.columns = 80;
  });

  afterEach(() => {
    process.stdout.columns = originalColumns;
  });

  describe('stripAnsiSgr', () => {
    it('removes ANSI SGR color codes while preserving visible text', () => {
      const input = '\x1b[31mHello\x1b[0m \x1b[1;32mWorld\x1b[0m';
      expect(stripAnsiSgr(input)).toBe('Hello World');
    });

    it('returns plain text unchanged', () => {
      expect(stripAnsiSgr('EZ Game Audio')).toBe('EZ Game Audio');
    });

    it('handles multiple codes on one line', () => {
      const input = '\x1b[38;5;196mR\x1b[38;5;202mG\x1b[38;5;226mB\x1b[0m';
      expect(stripAnsiSgr(input)).toBe('RGB');
    });
  });

  describe('renderSeaBanner', () => {
    it('centers each line based on visible width', () => {
      process.stdout.columns = 20;
      const rendered = renderSeaBanner();
      const lines = rendered.split('\n');

      for (const line of lines) {
        const visible = stripAnsiSgr(line);
        const leadingSpaces = line.length - line.trimStart().length;
        const expectedPadding = Math.max(
          0,
          Math.floor((20 - visible.trimStart().length) / 2)
        );
        expect(leadingSpaces).toBe(expectedPadding);
      }
    });

    it('does not pad when terminal is narrower than banner text', () => {
      process.stdout.columns = 4;
      const rendered = renderSeaBanner();
      expect(rendered.split('\n').every((line) => !line.startsWith('  '))).toBe(
        true
      );
    });
  });
});
