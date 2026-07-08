import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { moveOffset, truncateLine, showPagedList } from '../resultsPager.js';

describe('moveOffset', () => {
  const total = 100;
  const pageSize = 20;
  const maxOffset = total - pageSize; // 80

  it('moves one line up and down', () => {
    expect(moveOffset(10, 'down', total, pageSize)).toBe(11);
    expect(moveOffset(10, 'up', total, pageSize)).toBe(9);
  });

  it('moves a full page with pageup/pagedown', () => {
    expect(moveOffset(20, 'pagedown', total, pageSize)).toBe(40);
    expect(moveOffset(40, 'pageup', total, pageSize)).toBe(20);
  });

  it('jumps to start and end with home/end', () => {
    expect(moveOffset(50, 'home', total, pageSize)).toBe(0);
    expect(moveOffset(0, 'end', total, pageSize)).toBe(maxOffset);
  });

  it('clamps at the top', () => {
    expect(moveOffset(0, 'up', total, pageSize)).toBe(0);
    expect(moveOffset(3, 'pageup', total, pageSize)).toBe(0);
  });

  it('clamps at the bottom', () => {
    expect(moveOffset(maxOffset, 'down', total, pageSize)).toBe(maxOffset);
    expect(moveOffset(70, 'pagedown', total, pageSize)).toBe(maxOffset);
  });

  it('ignores unknown keys', () => {
    expect(moveOffset(15, 'x', total, pageSize)).toBe(15);
    expect(moveOffset(15, '', total, pageSize)).toBe(15);
  });

  it('never scrolls when the list fits on one page', () => {
    for (const key of ['up', 'down', 'pageup', 'pagedown', 'home', 'end']) {
      expect(moveOffset(0, key, 5, pageSize)).toBe(0);
    }
  });
});

describe('truncateLine', () => {
  it('leaves short lines untouched', () => {
    expect(truncateLine('short.wav', 80)).toBe('short.wav');
  });

  it('truncates long lines with an ellipsis and never exceeds width', () => {
    const long = 'x'.repeat(200);
    const out = truncateLine(long, 80);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(80);
  });

  it('keeps a line exactly at width - 1', () => {
    const line = 'y'.repeat(79);
    expect(truncateLine(line, 80)).toBe(line);
  });
});

describe('showPagedList (non-interactive under Jest)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing for an empty list', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await showPagedList('Files', []);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('prints a small list in full with no preview line', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const items = ['a.wav', 'b.wav', 'c.wav'];
    await showPagedList('Files', items);
    expect(logSpy).toHaveBeenCalledWith('a.wav\nb.wav\nc.wav');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('previews a big list and points at the CSV', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const items = Array.from({ length: 30000 }, (_, i) => `file-${i}.ogg`);
    await showPagedList('Files', items, 'see logs.csv');

    const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('file-0.ogg');
    expect(output).toContain('more (see logs.csv)');
    // Never dump the whole list.
    expect(output).not.toContain('file-25.ogg');
    expect(output.split('\n').length).toBeLessThan(30);
  });

  it('uses the provided hint for the failures list', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const items = Array.from({ length: 100 }, (_, i) => `bad-${i}.ogg`);
    await showPagedList('Failures', items, 'see error.csv');

    const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('more (see error.csv)');
  });
});
