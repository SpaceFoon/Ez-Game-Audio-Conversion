# Testing Backlog

Characterization tests document current behavior. Fix bugs in separate PRs and update these tests when behavior intentionally changes.

For the mutation-hardening roadmap and progress log, see [TESTING-HARDENING-PLAN.md](src/__tests__/TESTING-HARDENING-PLAN.md).

| ID | Finding | Status | Reproducing test |
|----|---------|--------|------------------|
| B44 | Embedded cover art is dropped from every output (`-vn`), and never has been kept. Documented in the README (Features, FAQ, Additional Notes). Copying it for MP3/M4A/FLAC would be a small change if wanted. | **Open** — documented, by design for now | — |

### Checked in the final pass and found OK

All run end to end with the bundled ffmpeg on Linux (Node 26):

- 6×6 format matrix (36 conversions): tags, channels and sample rate correct, apart from the entries above.
- Sample rates 8 kHz–192 kHz and 8/24/32-bit-float sources into all six formats (84 conversions, none failed).
- Opus loop rescaling from every source rate at or above 32 kHz.
- 26 unusual filenames (spaces, quotes, `%d`, `:`, leading `-`, unicode, emoji, 220-character names); only tab/newline names are rejected, by design.
- Rename-all, same-folder same-type rename, single-file mode, 40-file quiet-mode batch (every CSV row written).
- Packaged SEA build: folder argument, single-file argument, missing ffmpeg and missing worker file all report clear errors.
- Decoded audio stays sample-aligned for Vorbis, Opus, MP3 and AAC sources. ffmpeg itself changes the length slightly (AAC +956 trailing samples, Vorbis −128); that is upstream behaviour, not this app.

## Resolved (see also [`KNOWN_TEST_FINDINGS.md`](KNOWN_TEST_FINDINGS.md))

| ID | Finding | Resolution |
|----|---------|------------|
| B6 | Fatal abort left ffmpeg running (terminating a worker doesn't kill its child) | Workers report their ffmpeg PID; an abort (and Ctrl+C) kills it and removes the half-written output. Verified with an output symlinked to `/dev/full`: no ffmpeg left, no partial files |
| B7 | O(n²) failure dedupe | `Set` lookup |
| B8 | One read-only output aborted the whole batch | Only a full disk is batch-fatal; permission errors fail that one file. Verified: 1 failed, 7 converted, read-only file untouched |
| B9 | `streams[0]` used instead of the audio stream | `getAudioStream()` (first `codec_type: audio`) everywhere; inputs with no audio stream fail clearly |
| B10 | Failed/killed jobs left truncated outputs | Removed on failure, but only if this job wrote them (mtime check), so a pre-existing file ffmpeg never opened is never deleted |
| B11 | Same-type prompt showed `file(1).ogg` | Now shows `file-copy(1).ogg` |
| B12 | Smoke test couldn't fail | Fails on a signal/crash or missing startup text |
| B13 | Container housekeeping tags copied into outputs | Never-copied list: MP4 brands, handler/vendor ids, creation time, source encoder, `language=und` |
| B14 | iTunes gapless info (`iTunSMPB`) copied | Never copied |
| B15 | Opus failed on 3/4-channel layouts | Opus mapping family 255 for 3–4 (and >8) channels; verified 2.1, 3.0, 4.0, quad, 5.1 |
| B16 | OGG/Opus → AIFF dropped all tags | AIFF tags are rebuilt like every other format |
| B17 | Loop tags written twice, only lowercase survived | Written once, uppercase `LOOPSTART`/`LOOPLENGTH` |
| B18 | No ffprobe timeout; FIFO/device files hang | 60 s timeout + 64 MB buffer; search only picks regular files |
| B19 | Case folding on case-sensitive drives dropped real files | Case is ignored only where the filesystem ignores it (read-only per-folder probe); verified on ext4 and exFAT |
| B20 | Apple Silicon install copied Homebrew's dylib-linked ffmpeg; downloads could hang | Static arm64 builds (same source as CI); 60 s timeout, aborted/incomplete downloads fail |
| B21 | `loopDataMode` `skip`/`force` couldn't be set; `force` also wrote tags that ffmpeg drops from WAV and M4A | Before "Start now?", the app asks how to handle loop tags, only when an input has some (quick byte scan of the header/trailer and WAV `smpl` chunk). Blank = keep, `skip` = leave out, `force` (offered when WAV/M4A is an output) = WAV gets a `smpl` loop chunk, M4A keeps the tags via `use_metadata_tags`. Verified with the bundled ffmpeg |
| B22 | Piped answers lost; silent exits; Ctrl+C didn't cancel, then crashed | Input lines are buffered; ended input exits 1 with a message (0 at the final prompt); Ctrl+C kills ffmpeg, removes partial outputs and exits 130. Verified in a pty |
| B23 | MP3 loops wrong when the sample rate changes | MP3/AAC rates are picked explicitly and loop points rescaled (e.g. 96 kHz → 48 kHz) |
| B24 | `LOOPEND` sources lost half the loop | `LOOPEND` read (length = end − start) and written back alongside `LOOPLENGTH` |
| B25 | Context-menu script broke on paths with spaces or `)` | No space stripping, no `( )` blocks, `=`-safe parsing; `.aif`/`.opus` entries added. **Not run on Windows yet** |
| B26 | `q` treated as a path; `aif` dropped; `.opus` not searched | `q`/`quit`/`exit` quit; `aif`→aiff, `opus`→ogg; `.opus` files found with the OGG input format |
| B27 | Track/disc totals lost or written as `track_total` | `3/12` in the track field for MP3/M4A/AIFF/WAV; `TRACKTOTAL`/`DISCTOTAL` for OGG/FLAC |
| B28 | Whole output tree scanned every batch | Only the folders the batch writes to are listed |
| B29 | Output folders created before "Start now?" | Created after "yes", only for files being written |
| B30 | Corrupt/truncated inputs counted as successes | ffmpeg runs with `-xerror`; damaged MP3/FLAC now fail with the decoder error (see B43 for zero-length WAVs) |
| B31 | Symlinked project path never started | Entry check compares real paths |
| B32 | WAV `smpl` loops not read | RIFF `smpl` chunk parsed when a WAV has no loop tags; verified WAV → OGG/FLAC/MP3 |
| B33 | Mixed-case loop tags deleted; bad values silent | Loop tags matched ignoring case/separators; invalid values logged as warnings |
| B34 | Pager hid file names | Long lines are cut at the start, keeping the file name |
| B35 | Release `.sha256` files named the pre-rename archive | Workflow rewrites the name after renaming and checks it (`sha256sum -c`). **Takes effect on the next release run** |
| B36 | Portfolio workflow ran fork PRs on the self-hosted runner | Fork PRs are skipped. **Takes effect once merged** |
| B37 | Escaped/dragged paths and `~` rejected | Shell escapes undone on macOS/Linux; `~` expanded |
| B38 | CI lint step rewrote files instead of checking | `eslint .` + `prettier --check .` |
| B39 | `npm.cmd` spawned without a shell on Windows | npm run through `node $npm_execpath`. **Not run on Windows yet** |
| B40 | Opus loop units for sources under 32 kHz | Opus is always encoded at 48 kHz, so loop tags are in the units players decode at |
| B41 | Nits | (a) FLAC keeps the source bit depth (16-bit for lossy/≤16-bit sources); (b) ffmpeg/ffprobe checked before any prompt; (c) pager hints name the real log files; (e) `winston` removed; (f) dotenv runs quietly; (h) BOM removed from `banner.ts`; (i) `capture.mjs` removes its temp folder on failure. (d) cover art → B44; (g) see `CLAUDE.md` |
| B42 | Vorbis relabelled 2.1, 3.0(back), 4.0, 6.1(back), hexagonal, … as its own layout, so channels played from the wrong speakers | Those layouts are remixed to the Vorbis layout for the same channel count (`aformat`), e.g. 4.0 front-centre → front-left + front-right. Verified by per-channel level |
| B43 | A WAV with zero samples "converted" to an output with no audio | ffmpeg runs with `-abort_on empty_output_stream`; the job fails and the empty output is removed. FLAC output still exits 0 (ffmpeg writes a header-only FLAC) — harmless |
| B45 | `-ac <count>` on every job remixed non-default layouts: a quad source came out as 4.0 with both rear channels folded into back-centre, in every format | `-ac` is only passed for the MP3 stereo downmix; quad, 5.1(side), etc. are kept as they are. FLAC keeps non-standard layouts via `WAVEFORMATEXTENSIBLE_CHANNEL_MASK` (its warning is cosmetic) |
| B46 | Regression from B45: sources with no named channel layout (`unknown`, "6 channels", e.g. some 6-channel M4As) failed to convert to M4A — the AAC encoder rejects unnamed layouts, and `-ac` had been labelling them | `-ac` is passed only for sources with no named layout (it labels them with the default layout; nothing to remix). Named layouts still get no `-ac`. Verified: unknown 6-ch and quad into all six formats, 12/12 |
| B47 | Line breaks in tags (multi-line comments, lyrics) were flattened to spaces, "for spawn safety" — not needed, since ffmpeg runs without a shell | Kept as `\n` (CRLF/CR normalised). Verified in MP3, OGG, FLAC, M4A, AIFF and WAV |
| B48 | "Start now?" rejected `yes` with surrounding spaces (common when pasting) | Answer is trimmed; `y`/`n` also accepted |
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
