import { describe, it, expect } from '@jest/globals';
import ExitProgramError from '../exitProgramError.js';

describe('ExitProgramError', () => {
  it('sets default name and message', () => {
    const err = new ExitProgramError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ExitProgramError');
    expect(err.message).toBe('EXIT_PROGRAM');
  });

  it('allows custom message', () => {
    const err = new ExitProgramError('custom');
    expect(err.message).toBe('custom');
  });
});
