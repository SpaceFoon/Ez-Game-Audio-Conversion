// Custom Jest resolver for ESM TypeScript
// Remaps .js imports to .ts files in the src directory

const path = require('path');
const fs = require('fs');

module.exports = (request, options) => {
  // Only handle relative imports ending in .js
  if (request.startsWith('.') && request.endsWith('.js')) {
    // Try to resolve as .ts first
    const tsRequest = request.replace(/\.js$/, '.ts');
    const resolved = path.resolve(options.basedir, tsRequest);
    
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  
  // Fall back to default resolution
  return options.defaultResolver(request, options);
};
