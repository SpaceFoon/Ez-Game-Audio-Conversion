/**
 * When E2E_REQUIRED=1 (CI E2E job), missing ffmpeg/worker binaries fail the
 * suite immediately instead of silently skipping.
 */
export {
  e2eRequired,
  canRunIntegration,
  integrationSkipReason,
  ffmpegAvailable,
  workerAvailable,
  ffmpegPath,
  ffprobePath,
  requireIntegrationDeps,
} from './integrationGuard.js';

/** @deprecated Prefer importing from ffmpegGate.js */
export {
  resolveIntegrationDescribe,
  resolveIntegrationIt,
} from './ffmpegGate.js';

import { describe as jestDescribe, it as jestIt } from '@jest/globals';
import { e2eRequired } from './integrationGuard.js';

export const resolveE2eDescribe = (
  canRun: boolean,
  reason: string
): typeof jestDescribe => {
  if (e2eRequired && !canRun) {
    throw new Error(`E2E_REQUIRED=1: ${reason}`);
  }
  return canRun ? jestDescribe : jestDescribe.skip;
};

export const resolveE2eIt = (
  canRun: boolean,
  reason: string
): typeof jestIt => {
  if (e2eRequired && !canRun) {
    throw new Error(`E2E_REQUIRED=1: ${reason}`);
  }
  return canRun ? jestIt : jestIt.skip;
};
