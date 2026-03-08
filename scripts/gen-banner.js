#!/usr/bin/env node
/**
 * Captures the exact cfonts ANSI output and injects it into dist/banner.js,
 * replacing the '__SEA_BANNER__' sentinel before esbuild bundles the app.
 * Must run after `tsc` and before `esbuild`.
 */

import { readFileSync, writeFileSync } from 'fs';

// Force chalk to output full ANSI colour codes even when stdout is not a TTY.
process.env.FORCE_COLOR = '3';
// Render left-aligned; runtime centering will adapt to actual terminal width.

const { default: cfonts } = await import('cfonts');
const { render } = cfonts;

const result = render('|||EZ Game|Audio', {
  font: 'huge',
  align: 'left',
  gradient: ['green', '#f80'],
  background: 'black',
  independentGradient: true,
  transitionGradient: false,
  env: 'node',
});

if (!result) {
  console.error('[gen-banner] cfonts render() returned false — aborting.');
  process.exit(1);
}

const bannerPath = 'dist/banner.js';
let src = readFileSync(bannerPath, 'utf8');

const sentinel = "const BANNER_SNAPSHOT = '__SEA_BANNER__'";
if (!src.includes(sentinel)) {
  console.error(`[gen-banner] Sentinel ${sentinel} not found in ${bannerPath}`);
  process.exit(1);
}

src = src.replace(
  "const BANNER_SNAPSHOT = '__SEA_BANNER__'",
  `const BANNER_SNAPSHOT = ${JSON.stringify(result.string)}`
);
writeFileSync(bannerPath, src, 'utf8');

console.log('[gen-banner] Banner snapshot injected into dist/banner.js');
