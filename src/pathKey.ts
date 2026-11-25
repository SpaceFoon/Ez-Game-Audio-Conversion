// pathKey.ts
// Comparison keys for "is this the same file?" checks.
import * as fs from 'fs';
import { basename, dirname, join, resolve } from 'path';

/** Real (symlink-free) path of `p`, or its plain absolute path if that fails. */
export const realPathOr = (p: string): string => {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return resolve(p);
  }
};

/**
 * Key for a file path: its folder's real path plus the file name, lowercased.
 * Resolving the folder catches an output folder that is a symlink to the
 * input folder. Case is folded on every OS because case-insensitive drives
 * (WSL /mnt/c, NTFS, exFAT) are common on Linux too, and a false match only
 * costs a prompt while a missed one can overwrite an input.
 */
export const pathKey = (filePath: string): string => {
  const abs = resolve(filePath);
  return join(realFolder(dirname(abs)), basename(abs)).toLowerCase();
};

// Batches can hold 250k+ files in a few folders, so remember each folder's
// real path. Folders that don't exist yet aren't cached (they may be created).
const folderCache = new Map<string, string>();
const realFolder = (dir: string): string => {
  let real = folderCache.get(dir);
  if (real === undefined) {
    real = realPathOr(dir);
    if (fs.existsSync?.(dir)) folderCache.set(dir, real);
  }
  return real;
};

export const isSamePath = (a: string, b: string): boolean =>
  pathKey(a) === pathKey(b);
