class ExitProgramError extends Error {
  constructor(message: string = 'EXIT_PROGRAM') {
    super(message);
    this.name = 'ExitProgramError';
  }
}

/** Thrown by getAnswer when stdin has ended (piped input ran out, or Ctrl+D). */
export class InputClosedError extends Error {
  constructor() {
    super('Input ended before the question was answered.');
    this.name = 'InputClosedError';
  }
}

/** The user typed q/quit/exit at the input-folder prompt. */
export class UserQuitError extends Error {
  constructor() {
    super('Quit at user request.');
    this.name = 'UserQuitError';
  }
}

export default ExitProgramError;
