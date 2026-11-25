// cancel.ts
// Work to undo when the user cancels with Ctrl+C: kill running ffmpeg
// processes and remove half-written outputs.

const cancelCleanups = new Set<() => void>();

/** Register a cleanup; returns a function that unregisters it. */
export const registerCancelCleanup = (fn: () => void): (() => void) => {
  cancelCleanups.add(fn);
  return () => {
    cancelCleanups.delete(fn);
  };
};

/** Run every registered cleanup once. Never throws. */
export const runCancelCleanups = (): void => {
  for (const fn of [...cancelCleanups]) {
    try {
      fn();
    } catch {
      // Keep going: every cleanup should get its chance.
    }
  }
  cancelCleanups.clear();
};
