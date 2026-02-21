# Changelog

All notable changes to Ez Game Audio Conversion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.8.0] - 2026-02-07

### Added
- **Job summary in CSV logs** - Both logs.csv and error.csv now include a summary row with total files, passed/failed counts, and job duration
- **Exit code column** - Both logs.csv and error.csv now include exit code column for tracking conversion results
- **Proper CSV escaping** - New `escapeCsvField()` function handles commas, quotes, and newlines correctly
- **`getErrorMessage()` utility** - Centralized error-to-string helper used across the codebase
- **Versioned release archives** - Local builds now produce `EZ-Game-Audio-Conversion-v1.8.0.zip/.7z` instead of unversioned names
- **Platform-targeted ffmpeg bundling** - `post-sea.js` now copies only the target platform's ffmpeg binaries into the archive

### Changed
- **Improved CSV formatting** - Added UTF-8 BOM (`\uFEFF`) and quoted column headers for better spreadsheet compatibility
- **Dual error logging** - Failed conversions now logged to both logs.csv and error.csv for easier tracking
- **Safer type conversion** - Using `String()` constructor instead of `.toString()` to prevent null/undefined errors
- **CSV row construction** - Changed from string concatenation to array-based approach with proper field escaping
- **Worker bundle extension `.js` → `.cjs`** - Ensures the bundled worker is always loaded as CommonJS, even under a `"type":"module"` package scope
- **Removed `convertFiles.ts` wrapper** - `app.ts` and tests now import `convertFiles` directly from `converterManager.ts`
- **Removed `env.ts`** - Runtime environment detection consolidated into `utils.ts` and `app.ts`
- **Renamed type `AudioFormat` → `FfprobeFormat`** in `src/types/metadata.ts` to avoid collision with the audio format union type
- **SEA/CJS compatibility** - `utils.ts` now falls back to CJS globals (`__filename`/`__dirname`) when `import.meta.url` is unavailable in bundled builds
- **Smoke test rewrite** - Now extracts the ZIP archive into a temp directory and runs the binary from there, matching real user behavior
- **Hardened ffmpeg/ffprobe resolution** - Removed system PATH fallback; only bundled binaries in `ffmpeg-bin/<platform>/` are used
- **Release packaging overhaul** - `post-sea.js` rewritten with versioned archives, CI vs local detection, legacy alias support, and improved cleanup

### Fixed
- CSV files being misread as space-separated values instead of comma-separated (OpenOffice Calc auto-detection issue)
- Data corruption in CSV files - commas are now properly escaped instead of being stripped from values
- Newlines in error messages now replaced with spaces instead of being stripped entirely
- `app.test.ts` was mocking deleted `convertFiles.js` instead of `converterManager.js`
- Multiple test files updated to mock `getErrorMessage` and the new ffmpeg path resolution logic

## [1.7.0] - 2026-01-25

### Changed
- **Complete TypeScript migration** - Entire codebase converted from JavaScript to TypeScript for better type safety and maintainability
- **Native ES Modules** - Migrated from CommonJS to native ESM
- **Node.js SEA build** - Now builds as a Single Executable Application (no pkg dependency)
- **Node.js 24 LTS** - Updated runtime requirement

### Added
- **Multi-platform CI/CD** - GitHub Actions builds Windows, Linux, and macOS releases automatically
- **Comprehensive test suite** - 400+ tests covering unit, integration, and E2E scenarios
- **Checksum verification** - Release archives include `.sha256` files for integrity checking
- **Windows context menu integration** - Right-click "Convert Audio" option via batch scripts

### Fixed
- Cross-platform path handling for Unicode filenames
- CSV logging with special characters (commas, quotes, Unicode)
- Loop point preservation across all supported formats

### Developer Experience
- ESLint + Prettier with pre-commit hooks (Husky)
- `npm run readme` shows all available commands
- Detailed technical documentation in `docs/`

## [1.6.0] - 2025-11-24

### Changed
- Major internal refactoring
- Improved worker thread management
- Better error handling and logging

## [1.5.1] - 2024-xx-xx

### Fixed
- Minor bug fixes

## [1.5.0] - 2024-xx-xx

### Added
- Loop tag support for OGG Opus format
- Automatic sample rate adjustment for loop points

## [1.4.4] - 2024-xx-xx

### Added
- Initial public release
- Batch audio conversion with multi-threading
- Support for WAV, MP3, OGG, FLAC, AIFF, M4A formats
- Metadata preservation including iTunes tags
- Loop point support (LOOPSTART/LOOPLENGTH)
