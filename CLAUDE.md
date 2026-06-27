# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ez Game Audio Conversion is a batch audio converter designed for game developers. It converts audio files between multiple formats (WAV, MP3, OGG, FLAC, AIFF, M4A) with automatic handling of audio metadata, loop point tags, multi-threaded processing, and intelligent codec selection. The tool uses ffmpeg/ffprobe and Node.js worker threads to maximize performance.

**Module System:** Native ES Modules (ESM) targeting Node.js 24+
**Distribution:** Single Executable Application (SEA) using Node.js built-in feature
**Build System:** TypeScript → ESM → SEA, with automated multi-platform releases via GitHub Actions

## Development Commands

### Running the Application

```bash
npm run dev              # Build TypeScript then run compiled JS
```

### Building

```bash
npm run build            # Compile TypeScript to ES modules in dist/
npm run build:watch      # Watch mode compilation
npm run build:sea        # Build Single Executable Application (SEA)
npm run package          # Full release: SEA + docs + ffmpeg + archives
npm run clean            # Remove dist/ and release/ folders
```

**SEA Build Process (`npm run build:sea`):**
1. Compiles TypeScript to ESM
2. Bundles application with esbuild to CJS for SEA compatibility
3. Generates SEA blob from bundled app
4. Copies Node.js binary
5. Injects application blob into executable using `postject`
6. Outputs to `release/EZ-Game-Audio.exe` (Windows) or `release/EZ-Game-Audio` (Linux/macOS)
7. Cleans up temporary files (sea-config.json, sea-prep.blob)

**Full Package Build (`npm run package`):**
1. Runs SEA build
2. Generates HTML/PDF documentation from README
3. Copies ffmpeg binaries from `ffmpeg-bin/{platform}/`
4. Copies helper scripts (Windows .bat files)
5. Creates ZIP and 7z archives
6. Cleans up temporary files

**Icon/Metadata (Optional):**
- Icon exists at `media/ico/icon.ico`
- Icon + version metadata is applied automatically for Windows builds during `npm run package` via `src/ico/icon.js` (uses `resedit`)
- To skip icon injection: set `POST_SEA_SKIP_ICON=1`

### Testing

```bash
npm test                 # Run all tests sequentially
npm run test:unit        # Fast unit tests (no ffmpeg integration)
npm run test:integration # Real ffmpeg/worker integration tests only
npm run test:pre-release # Full verification ladder before tagging
npm run test:ci          # CI mode with open handle detection
npm run test:coverage    # Generate coverage report
npm run smoke            # Package and run smoke tests

# Run single test file:
npx jest src/__tests__/app.test.ts

# Run single test by name:
npx jest -t "test name pattern"
```

### Code Quality

```bash
npm run fix              # ESLint fix + Prettier format (combined)
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

**Critical Detail**: Binary and worker path resolution is centralised in `src/utils.ts` via `findBinary()`. The ESM/CJS `__dirname` detection is computed once there, and all modules call:

```typescript
import { findBinary, isPackagedRuntime } from './utils.js';

const workerExt = isPackagedRuntime ? 'cjs' : 'js';
const workerPath = findBinary(`converterWorker.${workerExt}`, ['dist']);
```

### Key Architectural Components

1. **app.ts** - Entry point, initializes `globalThis.env`, orchestrates promise chain
2. **getUserInput.ts** - Interactive CLI prompts for input/output paths and formats
3. **searchFiles.ts** - Recursive file system search for audio files
4. **createConversionList.ts** - Builds conversion jobs with conflict resolution (overwrite/rename/skip)
5. **converterManager.ts** - Spawns and manages worker thread pool, fatal ffmpeg error detection (disk space, etc.)
6. **converterWorker.ts** - Worker thread that executes ffmpeg commands and extracts metadata
7. **metadataService.ts** - Handles metadata extraction, loop point conversion, and formatting
8. **exitProgramError.ts** - Custom error class for silent program exit (caught by app.ts top-level handler)
9. **utils.ts** - Runtime detection (`isPackagedRuntime`, `isSeaRuntime`, `platformSlug`, `runtimeBaseDir`), `findBinary()` for locating bundled executables/workers, `getErrorMessage()`, CSV logging, file-busy checks, readline interface
10. **finalize.ts** - Results display, CSV summary output, and auto-restart functionality

### Global Environment Configuration

Type definitions are in `src/types/`: `global.ts` (runtime env), `settings.ts` (Settings object), `audio.ts` (audio types), `metadata.ts` (AudioMetadata).

The application uses `globalThis.env` for runtime configuration (type defined in `src/types/global.ts`):

- Platform detection (Windows/Mac/Linux)
- Architecture info (arch, platform)
- Execution context (isDev/isDebug/isPkg)
- CPU core count

This is initialized once at startup in `src/app.ts`.

## Important Patterns and Conventions

### Loop Point Sample Rate Conversion

When converting to Opus format, loop points must be adjusted for sample rate changes:

- Opus only supports specific sample rates: 8k, 12k, 16k, 24k, 48k
- The converter automatically adjusts `LOOPSTART` and `LOOPLENGTH` values based on the ratio between original and target sample rates
- This preserves timing accuracy when loop-enabled audio changes sample rates

**Limitation**: Loop points can only be written to OGG, FLAC, MP3, and AIFF. They can be read from all formats but cannot be written to WAV or M4A.

### Metadata Preservation

`src/metadataService.ts` extracts 100+ metadata fields using ffprobe and reapplies them via ffmpeg arguments. This includes:

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
spawn('ffmpeg', args, { shell: false });
```

Using `shell: false` lets Node.js properly quote arguments containing spaces on all platforms.

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

**Build Scripts:**
- `scripts/build-sea.js` - Creates SEA executable
- `scripts/post-sea.js` - Packages docs, binaries, creates archives

**Important Notes:**
- Requires Node.js 24+ (ESM support in SEA)
- Application is bundled to CJS via esbuild before SEA packaging
- Worker threads are bundled separately (cannot be inlined in SEA)
- `useCodeCache: true` - Code caching enabled for faster startup
- Platform-specific signing may be required (macOS: codesign, Linux: chmod +x)

## FFmpeg Binaries

Platform-specific ffmpeg binaries are stored in `ffmpeg-bin/`:

```
ffmpeg-bin/
├── README.md          # Download instructions
├── windows/
│   ├── ffmpeg.exe
│   └── ffprobe.exe
├── linux/
│   ├── ffmpeg
│   └── ffprobe
└── macos/
    ├── ffmpeg
    └── ffprobe
```

**Important:**
- Binaries are NOT committed to git (.gitignored)
- Each developer/CI runner downloads them once
- `npm run package` copies the `ffmpeg-bin/` directory into the release
- Download links: See `ffmpeg-bin/README.md`

**GitHub Actions automatically downloads ffmpeg during release builds**

## Testing Architecture

Tests are located in `src/__tests__/`:

- **Unit tests**: `*.test.ts` - Test individual modules with ESM mocking
- **Integration tests**: `integration/*.test.ts` - Test complete workflows (real ffmpeg + worker threads)
- **Audit tests**: `*.audit.test.ts` - Characterize known production gaps (see `KNOWN_TEST_FINDINGS.md`)
- **Fuzz tests**: `*Fuzz.test.ts` - Deterministic string/path edge-case generators
- **Smoke test**: `smokeTest.mjs` - Verifies packaged binary starts correctly
- **Test utilities**: `test-utils/` - Shared helpers and mock data generators

**ESM Mocking Pattern:** Tests use `jest.unstable_mockModule()` with dynamic `await import()` instead of CommonJS `jest.mock()`. Mocks must be declared before imports.

All tests run sequentially (`--runInBand`) to prevent file system race conditions.

CI downloads ffmpeg and runs the full suite including integration tests. See `ci.integration.guard.test.ts`.

**Test count:** 594 tests across 40 test files.

**Scripts:**
- `npm run test:unit` - Fast loop (no ffmpeg integration)
- `npm run test:integration` - Real ffmpeg/worker tests only
- `npm run test:pre-release` - Full ladder before tagging (unit → integration → release subset → smoke)

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
- **OGG**: libopus at 64k bitrate, or libvorbis with VBR quality 1.2
- **M4A**: AAC at 256k fixed bitrate
- **WAV/AIFF**: pcm_s16le (16-bit uncompressed)
- **FLAC**: Compression level 1 (minimal compression)

To modify bitrates or codecs, edit the `formatConfig` object and `getFormatConfig()` function in `src/converterWorker.ts`.

## Multi-Platform Releases

The project uses GitHub Actions to automatically build releases for all platforms.

### Release Workflow (`.github/workflows/release.yml`)

**Trigger:** Push a version tag (e.g., `v1.7.0`)

**What happens:**
1. Builds on Windows, Linux, and macOS runners in parallel
2. Downloads platform-specific ffmpeg binaries automatically
3. Runs `npm run package` on each platform
4. Creates platform-specific archives with SHA256 checksums:
   - `EZ-Game-Audio-Windows.zip` + `.7z` + `.sha256`
   - `EZ-Game-Audio-Linux.zip` + `.sha256`
   - `EZ-Game-Audio-macOS.zip` + `.sha256`
5. Creates a **DRAFT** GitHub Release with all artifacts

**Manual trigger:**
- Go to Actions → Release Build → Run workflow
- Set "Create GitHub Release" to "no" for testing builds without creating a release

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push/PR to `dev` or `main`:
- Linting and formatting
- TypeScript compilation
- Tests with coverage (594 tests; ffmpeg installed in CI)
- Build verification

### Creating a Release

```bash
# 1. Update version in package.json
# 2. Commit changes
git add .
git commit -m "chore: release v1.7.0"

# 3. Create and push tag
git tag v1.7.0
git push origin main
git push origin v1.7.0

# 4. GitHub Actions builds all platforms
# 5. Review draft release on GitHub
# 6. Publish when ready
```

See `.github/workflows/RELEASE-GUIDE.md` for detailed instructions.

## Cross-Platform Considerations

- Line endings: LF enforced via `.gitattributes` (CRLF only for `.bat`/`.ps1`)
- Git hooks: Husky pre-commit hook searches for `npx` in multiple locations (GitHub Desktop compatible)
- Executable extensions: `.exe` suffix automatically added on Windows
- File paths: Use `path.join()` and `path.resolve()` for cross-platform compatibility
- SEA builds: Platform-specific postject flags (macOS uses `--macho-segment-name`)
- Cannot cross-compile: Must build on each target platform (handled by GitHub Actions)

## Known Issues
When switching between Windows and WSL/Linux in the same working copy, `node_modules` can become incompatible (native binaries and resolved paths differ). If you switch environments, run `npm install` again before `npm run dev` or `npm run build`.

No other known issues currently tracked.
