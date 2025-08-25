class ExitProgramError extends Error {
  constructor(message: string = "EXIT_PROGRAM") {
    super(message);
    this.name = "ExitProgramError";
  }
}

module.exports = ExitProgramError;
