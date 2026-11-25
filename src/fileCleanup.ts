// fileCleanup.ts
// Removes partial outputs left by a failed or stopped conversion.
import * as fs from 'fs';

/**
 * Delete `filePath` only if it was modified at or after `sinceMs` — i.e. the
 * current job wrote it. Cleans up partial outputs without ever touching a
 * pre-existing file the job never opened (e.g. a read-only file ffmpeg could
 * not overwrite). Never throws.
 */
export const removeIfWrittenSince = (
  filePath: string,
  sinceMs: number
): void => {
  try {
    // 1 s slack for filesystems with coarse timestamps (FAT, some network drives).
    if (fs.statSync(filePath).mtimeMs >= sinceMs - 1000)
      fs.unlinkSync(filePath);
  } catch {
    // Missing or not removable: nothing to clean up.
  }
};
