import { describe, it, expect } from '@jest/globals';
import {
  canRunIntegration,
  integrationSkipReason,
  e2eRequired,
  requireIntegrationDeps,
} from './test-utils/integrationGuard.js';

describe('CI integration guard', () => {
  it('requires ffmpeg and worker when E2E_REQUIRED=1', () => {
    if (!e2eRequired) {
      return;
    }

    expect(canRunIntegration).toBe(true);
    expect(integrationSkipReason).toBe('');
    expect(() => requireIntegrationDeps()).not.toThrow();
  });

  it('documents skip reason when integration deps are missing locally', () => {
    if (e2eRequired || canRunIntegration) {
      return;
    }

    expect(integrationSkipReason.length).toBeGreaterThan(0);
  });
});
