# AGENTS.md

## Cursor Cloud specific instructions

This is a Node.js 24 CLI application (ES Modules). No web server, database, or Docker is needed.

### Prerequisites available in the environment
- **Node.js 24** (installed via nvm; `nvm use 24` or ensure default is set)
- **ffmpeg / ffprobe** available at `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`
- ffmpeg binaries must be symlinked into `ffmpeg-bin/linux/` for the app to find them at runtime (the app does NOT search `$PATH`; it uses `findBinary()` in `src/utils.ts` to check `ffmpeg-bin/{platform}/`)

### Quick reference (see `CLAUDE.md` and `package.json` scripts for full details)
- **Build:** `npm run build`
- **Lint + format:** `npm run fix` (ESLint + Prettier combined)
- **Tests:** `npm test` (468 tests, runs sequentially via `--runInBand`)
- **Run app:** `npm run dev` (builds then runs; the app is interactive CLI — pipe answers or use a helper script for non-TTY environments)

### Non-obvious caveats
- The app uses `readline` with `terminal: true`, so piping stdin directly may lose prompts. To automate interaction, spawn the process with `stdio: ['pipe', 'pipe', 'pipe']` and write answers with small delays between them.
- `ffmpeg-bin/` contents are gitignored. If the symlinks are missing after a fresh clone, recreate them: `mkdir -p ffmpeg-bin/linux && ln -sf /usr/bin/ffmpeg ffmpeg-bin/linux/ffmpeg && ln -sf /usr/bin/ffprobe ffmpeg-bin/linux/ffprobe`.
- Tests use `jest.unstable_mockModule()` + dynamic `await import()` for ESM mocking. The `--experimental-vm-modules` flag is required (already set in the `test` npm script).
- `npm run build:sea` and `npm run package` are not needed for development; they build standalone executables and require additional platform-specific tooling.
