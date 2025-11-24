# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ez Game Audio Conversion is a batch audio converter designed for game developers. It converts audio files between multiple formats (WAV, MP3, OGG, FLAC, AIFF, M4A) with automatic handling of audio metadata, loop point tags, multi-threaded processing, and intelligent codec selection. The tool uses ffmpeg/ffprobe and Node.js worker threads to maximize performance.

**Module System:** Native ES Modules (ESM) targeting Node.js 24+
**Distribution:** Single Executable Application (SEA) using Node.js built-in feature

## Development Commands

### Running the Application

```bash
npm run dev              # Run with ts-node ESM loader
npm run dev:watch        # Auto-reload on file changes (nodemon)
npm run dev:js           # Build TypeScript then run compiled JS
```

**Note:** The project uses ES modules. When running TypeScript directly, ts-node loads via the ESM loader: `node --loader ts-node/esm`

### Building

```bash
npm run build:ts         # Compile TypeScript to ES modules in dist/
npm run build:watch      # Watch mode compilation
npm run build:sea        # Build Single Executable Application (SEA)
npm run build            # Alias for build:ts
npm run clean            # Remove dist/ and release/ folders
```

**SEA Build Process:**
1. Compiles TypeScript to ESM
2. Generates SEA blob from `dist/app.js`
3. Copies Node.js binary
4. Injects application blob into executable using `postject`
5. Outputs to `release/ez-game-audio.exe` (Windows) or `release/ez-game-audio` (Linux/macOS)

### Testing

```bash
npm test                 # Run all tests sequentially
npm run test:ci          # CI mode with open handle detection
npm run test:coverage    # Generate coverage report
npm run smoke            # Package and run smoke tests

# Run single test file:
npx jest src/__tests__/app.test.js

# Run single test by name:
npx jest -t "test name pattern"
```

### Code Quality

```bash
npm run lint             # ESLint check
npm run format           # Auto-format with Prettier
```

Pre-commit hooks automatically run ESLint and Prettier on staged files via Husky + lint-staged.

## High-Level Architecture

### Promise Chain Execution Flow

The application uses a sequential promise chain in `src/app.ts`:

```
getUserInput → searchFiles → createConversionList → convertFiles → finalize
```

Each function passes a `Settings` object through the chain, modifying it with results.

### Worker Thread Pool Pattern

The conversion process (`src/converterManager.ts`) uses Node.js worker threads:

- Pool size = CPU core count (auto-detected)
- Workers pull jobs from a shared queue using `.pop()`
- Each worker spawns ffmpeg processes for individual conversions
- Parent thread collects results and aggregates success/failure counts

**Critical Detail**: Worker uses ESM import.meta.url for path resolution:

```typescript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workerPath = join(__dirname, 'converterWorker.js');
```

### Key Architectural Components

1. **app.ts** - Entry point, initializes `globalThis.env`, orchestrates promise chain
2. **getUserInput.ts** - Interactive CLI prompts for input/output paths and formats
3. **searchFiles.ts** - Recursive file system search for audio files
4. **createConversionList.ts** - Builds conversion jobs with conflict resolution (overwrite/rename/skip)
5. **converterManager.ts** - Spawns and manages worker thread pool
6. **converterWorker.ts** - Worker thread that executes ffmpeg commands and extracts metadata
7. **metadataService.ts** - Handles metadata extraction, loop point conversion, and formatting
8. **utils.ts** - CSV logging, disk space checks, readline interface
9. **finalize.ts** - Results display and auto-restart functionality

### Global Environment Configuration

The application uses `globalThis.env` for runtime configuration (defined in `src/types/global.ts`):

- Platform detection (Windows/Mac/Linux)
- Execution context (dev/debug/pkg)
- CPU core count
- Command-line arguments

This is initialized once at startup in `src/app.ts`.

## Important Patterns and Conventions

### Loop Point Sample Rate Conversion

When converting to Opus format, loop points must be adjusted for sample rate changes:

- Opus only supports specific sample rates: 8k, 12k, 16k, 24k, 48k
- The converter automatically adjusts `LOOPSTART` and `LOOPLENGTH` values based on the ratio between original and target sample rates
- This preserves timing accuracy when loop-enabled audio changes sample rates

**Limitation**: Loop points can only be written to OGG, FLAC, MP3, and AIFF. They can be read from all formats but cannot be written to WAV or M4A.

### Metadata Preservation

`src/metadataService.ts` extracts 60+ metadata fields using ffprobe and reapplies them via ffmpeg arguments. This includes:

- Standard tags (title, artist, album, etc.)
- iTunes-specific metadata
- Podcast metadata
- ReplayGain tags
- Loop points (LOOPSTART/LOOPLENGTH)

String sanitization prevents command injection vulnerabilities.

### Child Process Security

Workers use `spawn()` instead of `exec()` to prevent shell injection. Commands are built as arrays:

```typescript
const args = ['-i', inputFile, '-c:a', codec, outputFile];
spawn('ffmpeg', args, { windowsVerbatimArguments: true });
```

The `windowsVerbatimArguments: true` option ensures Windows compatibility.

### Conflict Resolution System

When output files already exist, users can:

- `o` - Overwrite (won't overwrite self)
- `r` - Rename with `-copy(n)` suffix
- `s` - Skip
- `oa`/`ra`/`sa` - Apply choice to all subsequent conflicts

This is handled in `src/createConversionList.ts`.

### CSV Logging

Success logs go to `logs.csv`, errors go to `error.csv`. If files are busy, the logger automatically increments filenames: `logs(1).csv`, `logs(2).csv`, etc.

Logs include: timestamp, exit code, input path, output path, error messages.

## Single Executable Application (SEA) Configuration

The project uses Node.js 24's built-in SEA feature to create standalone executables. Configuration is in `scripts/build-sea.js`:

**Build Process:**
1. Generates blob from `dist/app.js` using `--experimental-sea-config`
2. Copies Node.js binary to `release/`
3. Injects blob using `postject` tool
4. Creates platform-specific executables

**Important Notes:**
- Worker threads work seamlessly in SEA (no special configuration needed)
- The SEA blob includes all ESM imports
- External Requirements: `ffmpeg.exe` and `ffprobe.exe` must still be in the same directory as the executable
- Platform-specific signing may be required (macOS: codesign, Linux: chmod +x)

## Testing Architecture

Tests are located in `src/__tests__/`:

- **Unit tests**: `*.test.js` - Test individual modules
- **Integration tests**: `integration/*.test.js` - Test complete workflows
- **Test utilities**: `test-utils/` - Shared helpers and mock data generators

All tests run sequentially (`--runInBand`) to prevent file system race conditions.

Coverage thresholds: 40% branches, 50% functions, 55% lines/statements.

## TypeScript Configuration

- Target: ES2022
- Module: NodeNext (native ESM)
- Module Resolution: NodeNext
- Strict mode enabled
- Source maps generated for debugging
- Output directory: `dist/`

**Important ESM Requirements:**
- All relative imports must include `.js` extension (even in `.ts` files)
- Use `import.meta.url` for entry point detection (not `require.main === module`)
- For `__dirname` replacement: `dirname(fileURLToPath(import.meta.url))`

## Format-Specific Codec Selection

Codecs are hardcoded in `src/converterWorker.ts`:

- **MP3**: libmp3lame with VBR quality 4 (~160kbps)
- **OGG**: libopus (preferred) or libvorbis with quality 6
- **M4A**: AAC at 256k fixed bitrate
- **WAV/AIFF**: pcm_s16le (16-bit uncompressed)
- **FLAC**: Compression level 9 (maximum)

To modify bitrates or codecs, edit `getCodec()` and `getBitrate()` functions in `src/converterWorker.ts`.

## Cross-Platform Considerations

- Line endings: LF enforced via `.gitattributes` (CRLF only for `.bat`/`.ps1`)
- Git hooks: Husky pre-commit hook uses `npx` (not hardcoded Windows paths)
- Executable extensions: `.exe` suffix automatically added on Windows
- File paths: Use `path.join()` and `path.resolve()` for cross-platform compatibility
- SEA builds: Use platform-specific postject flags (different for Windows/macOS/Linux)

## Known Issues

**Test File Errors:** `src/__tests__/utils.test.js` has ESLint errors due to ESM migration:
- `fileNameL` and `fileNameE` are now internal to `utils.ts`
- Tests need refactoring to not directly manipulate these variables
- Alternatively, export them as mutable references if tests require direct access
