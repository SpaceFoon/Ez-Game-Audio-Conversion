#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const summaryPath = join(process.cwd(), 'coverage', 'coverage-summary.json');
const branchThreshold = Number(process.env.COVERAGE_BRANCH_GAP_THRESHOLD ?? 70);

if (!existsSync(summaryPath)) {
  console.warn(
    '[coverage-gaps] No coverage-summary.json found — run test:coverage first.'
  );
  process.exit(0);
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const gaps = [];

for (const [filePath, metrics] of Object.entries(summary)) {
  if (filePath === 'total') continue;
  const branches = metrics.branches?.pct;
  if (typeof branches === 'number' && branches < branchThreshold) {
    gaps.push({ filePath, branches });
  }
}

gaps.sort((a, b) => a.branches - b.branches);

if (gaps.length === 0) {
  console.log(
    `[coverage-gaps] All files meet branch coverage >= ${branchThreshold}%`
  );
  process.exit(0);
}

console.log(
  `[coverage-gaps] ${gaps.length} file(s) below ${branchThreshold}% branch coverage:\n`
);
for (const gap of gaps) {
  console.log(`  ${gap.branches.toFixed(1)}%  ${gap.filePath}`);
}
