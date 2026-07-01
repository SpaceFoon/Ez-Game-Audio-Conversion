# Known Test Findings

Audit tests in this repo document production behavior. Resolved items are kept for regression history.

For the mutation-hardening roadmap, see [TESTING-HARDENING-PLAN.md](./TESTING-HARDENING-PLAN.md).

| ID | Finding | Status | Test file |
|----|---------|--------|-----------|
| KB-001 | ffprobe failure previously continued with metadata stripped and forced stereo | **Fixed** — conversion fails when ffprobe cannot read metadata | `ffprobeFallback.audit.test.ts` |
| KB-002 | Fatal ffmpeg early-abort required injected stderr IPC; worker did not stream stderr | **Fixed** — worker forwards stderr chunks to parent | `stderrIpc.audit.test.ts`, `converterFailureModes.test.ts` |
| KB-003 | `loopDataMode: 'force'` was typed but behaved like `'auto'` | **Fixed** — `force` writes loop metadata even on WAV/M4A | `loopDataMode.audit.test.ts` |
| KB-004 | Silent duplicate output collision — second input dropped with no warning | **Fixed** — duplicates are dropped with a "Skipping duplicate output" warning | `knownBugs.characterization.test.ts`, `createConversionList.audit.test.ts` |
| KB-005 | Worker exit 0 before error message can false-mark success | **Fixed** — success requires a worker `code` message; an unconfirmed exit is a failure | `converterManager.workerRace.audit.test.ts`, `converterFailureModes.test.ts` |

## Pre-release verification

Run before tagging a release:

```bash
npm run test:pre-release
```

This executes, in order: unit tests, property tests, ffmpeg integration tests, release subset tests, and the packaged smoke test.
