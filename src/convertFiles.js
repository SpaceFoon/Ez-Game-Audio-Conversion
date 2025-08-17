"use strict";

// Thin wrapper to expose convertFiles for tests and app code.
// Delegates to the implementation in converterManager.js to avoid duplication.
module.exports = require("./converterManager");
