"use strict";
class ExitProgramError extends Error {
    constructor(message = "EXIT_PROGRAM") {
        super(message);
        this.name = "ExitProgramError";
    }
}
module.exports = ExitProgramError;
//# sourceMappingURL=exitProgramError.js.map