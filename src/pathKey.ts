// pathKey.ts
// Comparison keys for "is this the same file?" checks.
import * as fs from 'fs';
// Namespace import: some tests mock 'path' with only a few functions.
import * as path from 'path';
const { basename, dirname, join, resolve } = {
  basename: (p: string) => path.basename(p),
  dirname: (p: string) => path.dirname(p),
  join: (...p: string[]) => path.join(...p),
  resolve: (...p: string[]) => path.resolve(...p),
};

/** Real (symlink-free) path of `p`, or its plain absolute path if that fails. */
export const realPathOr = (p: string): string => {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return resolve(p);
  }
};

/** Swap upper and lower case; null when the name has no letters. */
const flipCase = (name: string): string | null => {
  const flipped = [...name]
    .map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()))
    .join('');
  return flipped === name ? null : flipped;
};

/** Same file or folder? (stat identity) */
const sameEntry = (a: string, b: string): boolean => {
  const x = fs.statSync(a);
  const y = fs.statSync(b);
  return x.ino === y.ino && x.dev === y.dev;
};

/**
 * Probe paths for `dir`: an entry inside it (its names live on `dir`'s own
 * filesystem — the folder's own name lives on the parent's, which matters for
 * a drive's mount point), falling back to the folder itself.
 */
const caseProbes = (dir: string): Array<[string, string]> => {
  const probes: Array<[string, string]> = [];
  try {
    const handle = fs.opendirSync(dir);
    try {
      for (let i = 0; i < 64; i++) {
        const entry = handle.readSync();
        if (!entry) break;
        const flipped = flipCase(entry.name);
        if (flipped) {
          probes.push([join(dir, entry.name), join(dir, flipped)]);
          break;
        }
      }
    } finally {
      handle.closeSync();
    }
  } catch {
    // Unreadable: fall through to the folder-name probe.
  }
  const name = basename(dir);
  const flipped = name ? flipCase(name) : null;
  if (flipped) probes.push([dir, join(dirname(dir), flipped)]);
  return probes;
};

const platformDefaultInsensitive = (): boolean =>
  process.platform === 'win32' || process.platform === 'darwin';

// One answer per folder; batches can hold 250k+ files in a few folders.
const caseCache = new Map<string, boolean>();

/**
 * Whether names inside `dir` ignore letter case. Checked, not assumed:
 * Linux can mount case-insensitive drives (WSL /mnt/c, NTFS, exFAT) and
 * macOS can format case-sensitive volumes. An entry of the folder (or of its
 * nearest existing parent) is looked up under its case-flipped name: if that
 * opens the very same entry, case doesn't matter there. Read-only — nothing
 * is written into the user's folders.
 */
/** Tests: force the case-sensitivity answer (null = detect for real). */
let caseOverride: boolean | null = null;
export const __setCaseInsensitiveForTests = (value: boolean | null): void => {
  caseOverride = value;
  caseCache.clear();
};

export const isCaseInsensitiveDir = (dir: string): boolean => {
  if (caseOverride !== null) return caseOverride;
  let probe = resolve(dir);
  while (!fs.existsSync?.(probe)) {
    const parent = dirname(probe);
    if (parent === probe) return platformDefaultInsensitive();
    probe = parent;
  }
  const cached = caseCache.get(probe);
  if (cached !== undefined) return cached;

  let result = platformDefaultInsensitive();
  if (
    typeof fs.statSync === 'function' &&
    typeof fs.opendirSync === 'function'
  ) {
    const [first] = caseProbes(probe);
    if (first) {
      try {
        result = sameEntry(first[0], first[1]);
      } catch {
        result = false; // The flipped name doesn't exist: case matters.
      }
    }
  }
  caseCache.set(probe, result);
  return result;
};

/**
 * Key for a file path: its folder's real path plus the file name, with case
 * folded only where the filesystem ignores case. Resolving the folder catches
 * an output folder that is a symlink to the input folder. On a case-sensitive
 * drive `Boss.ogg` and `boss.ogg` are different files and must stay apart.
 */
export const pathKey = (filePath: string): string => {
  const abs = resolve(filePath);
  const folder = realFolder(dirname(abs));
  const key = join(folder, basename(abs));
  return isCaseInsensitiveDir(folder) ? key.toLowerCase() : key;
};

// Folders that don't exist yet aren't cached (they may be created).
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
