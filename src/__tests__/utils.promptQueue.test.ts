/**
 * Node's readline silently ignores a second rl.question() while one is still
 * pending, so concurrent prompts must be queued, never issued in parallel.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { createSerialAsker } from '../utils.js';

/** Fake readline that behaves like Node: drops a question while one is pending. */
const createDroppingRl = () => {
  let pending: ((answer: string) => void) | null = null;
  return {
    question: jest.fn((_q: string, cb: (answer: string) => void) => {
      if (pending) return; // what Node does
      pending = cb;
    }),
    close: jest.fn(),
    answer(text: string) {
      const cb = pending;
      pending = null;
      cb?.(text);
    },
  };
};

const flush = () => new Promise((r) => setImmediate(r));

describe('createSerialAsker', () => {
  beforeEach(() => {
    console.log = jest.fn();
  });

  it('answers concurrent prompts one after another, in order', async () => {
    const rl = createDroppingRl();
    const ask = createSerialAsker(() => rl);

    const first = ask('first?');
    const second = ask('second?');
    await flush();
    rl.answer('one');
    await flush();
    rl.answer('two');

    await expect(first).resolves.toBe('one');
    await expect(second).resolves.toBe('two');
    expect(rl.question).toHaveBeenCalledTimes(2);
  });

  it('shows the second question only after the first is answered', async () => {
    const rl = createDroppingRl();
    const ask = createSerialAsker(() => rl);

    void ask('first?');
    void ask('second?');
    await flush();
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('first?');
    rl.answer('one');
    await flush();
    expect(console.log).toHaveBeenLastCalledWith('second?');
  });
});
