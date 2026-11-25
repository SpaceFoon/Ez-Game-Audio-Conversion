# Testing Backlog

Characterization tests document current behavior. Fix bugs in separate PRs and update these tests when behavior intentionally changes.

For the mutation-hardening roadmap and progress log, see [TESTING-HARDENING-PLAN.md](src/__tests__/TESTING-HARDENING-PLAN.md).

| ID | Finding | Status | Reproducing test |
|----|---------|--------|------------------|
| B6 | Fatal abort terminates worker threads but not their ffmpeg child processes — `worker.terminate()` does not kill spawned children, so in-flight ffmpeg keeps writing to a full disk (B4 only half fixed). Verified: a child spawned in a worker is still alive after `terminate()`. `src/converterManager.ts:246` | **Open** — confirmed | — |
| B7 | `recordFailure` dedupes with `failedFiles.some(...)` → O(n²). 50k failures ≈ 4.5 s, 250k ≈ 2 min; hit when ffmpeg is missing, every file fails, or the abort path marks the queue as skipped. Outputs are already unique after `removeDuplicates`. `src/converterManager.ts:128` | **Open** — confirmed | — |
| B8 | One existing read-only output (with `o`/`oa`) aborts the whole batch: ffmpeg's `<path>: Permission denied` still matches after `stripJobPaths`, so a per-file error is treated as batch-fatal and every queued file is marked skipped. `src/converterManager.ts:44` | **Open** — confirmed by code reading | — |
| B9 | Sample rate, channel count and loop conversion read `streams[0]`, not the first audio stream. If cover art is stream 0: `-ac 2` fallback (mono→stereo, surround downmix) and Opus loop points are not rescaled. `src/metadataService.ts:405,455,524` | **Open** — plausible | — |
| B10 | Failed or killed ffmpeg runs leave a truncated output file (`-y`); the next run treats it as "already exists" and `sa` skips it. `src/converterWorker.ts:422` | **Open** — plausible | — |
| B12 | Packaged smoke test can't fail when the binary doesn't start: a crash or kill (`status` null, `signal` set, no `res.error`) only prints a warning, and missing startup text is also only a warning → exit 0. A broken release binary still passes CI. `src/__tests__/smokeTest.mjs:133-160` | **Open** — confirmed by code reading | — |
| B13 | Container and stream housekeeping tags are copied into outputs as real tags. An ffmpeg-made M4A → OGG gets `handler_name=SoundHandler`, `vendor_id=[0][0][0][0]`, `major_brand=M4A`, `minor_version`, `compatible_brands`, `language=und`. Verified with ffprobe on the output. Passthrough in `formatMetaDataArgs` needs a denylist. `src/metadataService.ts:435` | **Open** — confirmed | — |
| B14 | iTunes gapless info (`iTunSMPB`) is copied to re-encoded outputs. It describes the *source* encoder's priming/padding, so gapless players trim the wrong samples — bad for seamless loops. The canonical entry `itunessmpb` doesn't even match the real key (normalizes to `itunsmpb`), so it goes through passthrough. `src/metadataService.ts:76,435` | **Open** — plausible (needs an iTunes-encoded source to confirm) | — |
| B15 | Opus output fails for some multichannel layouts. A 4-channel WAV (layout 4.0) → Opus exits 234: `Invalid channel layout 4.0 for specified mapping family -1`. The same file → Vorbis "succeeds" but warns the output channel layout is wrong. 5.1 and 5.1(side) work. Fix: `-mapping_family 255` or downmix for unsupported layouts. `src/converterWorker.ts:212,320` | **Open** — confirmed | — |
| B16 | OGG/Opus → AIFF drops **all** tags (title, artist, …). AIFF uses `preserveMetadata` and skips `metaDataArgs`, but Vorbis comments are stream-level in ffmpeg and the AIFF ID3 writer only keeps global metadata. Verified: `title=MyTitle artist=Me` OGG → AIFF has only `encoder`. `src/converterWorker.ts:231,303` | **Open** — confirmed | — |
| B17 | Each loop tag is written twice (`LOOPSTART` + `loopstart`), but ffmpeg's metadata dictionary ignores case, so the second overwrites the first. Every output ends up with only lowercase `loopstart`/`looplength`; the uppercase form the comment calls "most widely supported" is never written. Readers that match ID3 TXXX/Vorbis keys case-sensitively miss the loop. Verified on OGG, FLAC, MP3, AIFF. `src/metadataService.ts:586` | **Open** — confirmed | — |
| B18 | No timeout on ffprobe (`spawnSync`) or ffmpeg. A file that never returns data (a FIFO or device named `*.wav`, a stalled network or cloud-placeholder file) hangs that worker and the whole batch forever. ffprobe also uses the default 1 MB `maxBuffer`, so huge tags give ENOBUFS → "Could not read metadata". `src/metadataService.ts:360`, `src/converterWorker.ts:404` | **Open** — plausible | — |
| B19 | Case-folded `pathKey` on case-sensitive Linux makes `removeDuplicates` drop real files: `Boss.wav` and `boss.wav` in one folder map to `Boss.ogg`/`boss.ogg`, which are treated as one output, so the second input is skipped (not just prompted, as the `pathKey.ts` comment assumes). `src/createConversionList.ts:556` | **Open** — confirmed by code reading | — |
| B20 | `npm run install:ffmpeg` on Apple Silicon copies Homebrew's ffmpeg, which is linked against Homebrew dylibs. A local `npm run package` on an arm64 Mac then ships an ffmpeg that fails with "Library not loaded" on machines without Homebrew ffmpeg. CI is unaffected (it uses static builds). `downloadFile` also has no timeout and ignores mid-stream errors, so a dropped connection can hang the install. `scripts/install-ffmpeg.js:157,192` | **Open** — plausible | — |
| B21 | `loopDataMode` (`skip`/`force`) can't be set by the user: nothing in `getUserInput` or the settings sets it, so the app always runs `auto` and those modes only exist in tests. `src/converterManager.ts:200` | **Open** — gap | — |
| B11 | Same-type prompt says files become `file(1).ogg`, but they're actually named `file-copy(1).ogg`. `src/createConversionList.ts:389` | **Open** — nit | — |

## Resolved (see also [`KNOWN_TEST_FINDINGS.md`](KNOWN_TEST_FINDINGS.md))

| ID | Finding | Resolution |
|----|---------|------------|
| B1 | Two inputs mapping to the same output path: second silently dropped | Duplicate outputs are dropped with a "Skipping duplicate output" warning naming both inputs |
| B2 | `isFileBusy` returned `false` after the EBUSY prompt without re-checking | Re-opens the file after the prompt (up to 10 attempts); returns `true` if still locked |
| B3 | Worker `exit(0)` without a prior `code` message was treated as success | Success requires the worker's `code` message; an unconfirmed exit is recorded as a failure |
| B4 | Fatal ffmpeg abort left in-flight workers running | Fatal disk/permission errors now terminate all other active workers immediately (ffmpeg children still survive — see B6) |
| B5 | Single-file CLI mode did not validate extension against `inputFormats` | Unsupported single-file paths are rejected and recorded as a search error |
| KB-001 | ffprobe failure continued with stripped metadata | Conversion fails when metadata cannot be read |
| KB-002 | Fatal stderr required injected IPC | Worker forwards stderr to parent |
| KB-003 | `loopDataMode: 'force'` unimplemented | `force` writes loops even on WAV/M4A |

## Pre-release verification

```bash
npm run test:pre-release
```

Runs unit → property → integration → smoke. For local maximum coverage before a release:

```bash
npm run test:all
npm run test:integration
npm run test:mutation   # optional, slower
```
