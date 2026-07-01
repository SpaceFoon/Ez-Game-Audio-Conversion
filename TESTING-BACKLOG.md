# Testing Backlog

Characterization tests document current behavior. Fix bugs in separate PRs and update these tests when behavior intentionally changes.

For the mutation-hardening roadmap and progress log, see [TESTING-HARDENING-PLAN.md](src/__tests__/TESTING-HARDENING-PLAN.md).

| ID | Finding | Status | Reproducing test |
|----|---------|--------|------------------|
| _none_ | All previously tracked bugs (B1–B5) are resolved. | — | — |

## Resolved (see also [`KNOWN_TEST_FINDINGS.md`](KNOWN_TEST_FINDINGS.md))

| ID | Finding | Resolution |
|----|---------|------------|
| B1 | Two inputs mapping to the same output path: second silently dropped | Duplicate outputs are dropped with a "Skipping duplicate output" warning naming both inputs |
| B2 | `isFileBusy` returned `false` after the EBUSY prompt without re-checking | Re-opens the file after the prompt (up to 10 attempts); returns `true` if still locked |
| B3 | Worker `exit(0)` without a prior `code` message was treated as success | Success requires the worker's `code` message; an unconfirmed exit is recorded as a failure |
| B4 | Fatal ffmpeg abort left in-flight workers running | Fatal disk/permission errors now terminate all other active workers immediately |
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
