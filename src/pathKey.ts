// pathKey.ts
// Canonical keys for comparing file paths ("is this the same file?").
// Namespace imports so a partially mocked 'fs' (in tests) just degrades to
// plain resolve()-based keys instead of failing to load.
import * as fs from 'fs';
import { basename, dirname, join, resolve } from 'path';

const realpath = (p: string): string => {
  const fn = fs.realpathSync?.native ?? fs.realpathSync;
  if (typeof fn !== 'function') throw new Error('realpath unavailable');
  return fn(p);
};

/**
 * Resolve the real (symlink-free) path of `dir`. A directory that does not
 * exist yet (an output folder still to be created) resolves through its
 * nearest existing ancestor.
 */
const realDir = (dir: string, cache?: Map<string, string>): string => {
  const cached = cache?.get(dir);
  if (cached !== undefined) return cached;

  let real: string;
  try {
    real = realpath(dir);
    cache?.set(dir, real);
  } catch {
    const parent = dirname(dir);
    // Only cache successful lookups: a folder created later must resolve again.
    real = parent === dir ? dir : join(realDir(parent, cache), basename(dir));
  }
  return real;
};

/**
 * Build a function that maps a path to a comparison key: absolute, with
 * symlinks / aliased folders resolved, and always lowercased. Case is folded
 * even on Linux on purpose: case-insensitive mounts (WSL /mnt/c, NTFS/exFAT
 * drives) are common, and a false "same file" only costs a prompt while a
 * missed one can overwrite an input. Each keyer has its own directory cache,
 * so create one per batch.
 */
export const createPathKeyer = (): ((filePath: string) => string) => {
  const cache = new Map<string, string>();
  return (filePath: string): string => {
    const abs = resolve(filePath);
    return join(realDir(dirname(abs), cache), basename(abs)).toLowerCase();
  };
};

/** Real path of `p`, or its plain absolute form if it can't be resolved. */
export const realPathOr = (p: string): string => {
  try {
    return realpath(p);
  } catch {
    return resolve(p);
  }
};

/** One-off comparison: true when both paths name the same file. */
export const isSamePath = (a: string, b: string): boolean => {
  const key = createPathKeyer();
  return key(a) === key(b);
};
