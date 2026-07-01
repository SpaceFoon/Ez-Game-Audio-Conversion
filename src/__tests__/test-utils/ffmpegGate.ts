/**
 * Shared gate for integration tests requiring bundled ffmpeg + compiled worker.
 * Alias of integrationGuard exports (plan name: ffmpegGate).
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

import { describe as jestDescribe, it as jestIt } from '@jest/globals';
import { e2eRequired } from './integrationGuard.js';

export const resolveIntegrationDescribe = (
  canRun: boolean,
  reason: string
): typeof jestDescribe => {
  if (e2eRequired && !canRun) {
    throw new Error(`E2E_REQUIRED=1: ${reason}`);
  }
  return canRun ? jestDescribe : jestDescribe.skip;
};

export const resolveIntegrationIt = (
  canRun: boolean,
  reason: string
): typeof jestIt => {
  if (e2eRequired && !canRun) {
    throw new Error(`E2E_REQUIRED=1: ${reason}`);
  }
  return canRun ? jestIt : jestIt.skip;
};
