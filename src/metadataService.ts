//metaDataService.ts
import type { AudioMetadata } from './types/metadata.js';
import { getAudioStream } from './audioStream.js';
import { readWavSmplLoop } from './wavLoops.js';

export { getAudioStream };

import { spawnSync } from 'child_process';
import * as workerThreads from 'worker_threads';
import { platformSlug, findBinary, addToLog } from './utils.js';
import logger from './logger.js';

const CANONICAL_FIELDS = [
  // Basic fields (ffmpeg canonical keys)
  'title',
  'artist',
  'album',
  'album_artist',
  'track',
  'track_total',
  'disc',
  'disc_total',
  'genre',
  'date',
  'composer',
  'lyricist',
  'lyrics',
  'comment',
  'description',
  'subtitle',
  'grouping',
  'title_sort',
  'artist_sort',
  'album_sort',
  'album_artist_sort',
  'composer_sort',
  'language',
  'bpm',
  'initial_key',
  'key',
  'mood',
  'rating',
  'isrc',
  'iswc',
  'encoded_by',
  'publisher',
  'copyright',
  'compilation',
  'work',
  'movement',
  'movementname',
  'movementtotal',
  'ensemble',
  'orchestra',
  'soloist',

  // ReplayGain / loudness
  'replaygain_track_gain',
  'replaygain_track_peak',
  'replaygain_album_gain',
  'replaygain_album_peak',
  'r128_track_gain',
  'r128_album_gain',

  // iTunes-specific
  'itunesadvisory',
  'itunesalbumid',
  'itunesartistid',
  'itunescomposerid',
  'itunesgenreid',
  'itunespodcast',
  'itunesseason',
  'itunesepisode',
  'itunesepisodetype',
  'itunesauthor',
  'itunescopyright',
  'ituneskeywords',
  'itunesu',
  'itunnorm',

  // Podcast-specific
  'podcastid',
  'podcasturl',
  'podcastfeed',
  'podcastdesc',
  'podcastkeywords',
  'podcastauthor',
  'podcastsubtitle',
  'episode_id',
  'season_number',
  'show',
  'network',

  // Others
  'media_type',
  'category',
  'license',
  'website',
  'original_artist',
  'original_album',
  'original_year',
  'original_date',
  'release_date',
  'source',
  'label',
  'catalog_number',
  'barcode',
  'location',
  'performer',
  'conductor',
  'engineer',
  'remixer',
  'mixartist',
  'arranger',
  'producer',
  'director',
  'commenter',
  'musicbrainz_trackid',
  'musicbrainz_recordingid',
  'musicbrainz_albumid',
  'musicbrainz_releaseid',
  'musicbrainz_releasegroupid',
  'musicbrainz_artistid',
  'musicbrainz_albumartistid',
  'musicbrainz_workid',
  'musicbrainz_trmid',
  'musicbrainz_discid',
  'musicbrainz_originalalbumid',
];

const normalizeTagKey = (key: string): string =>
  key.toLowerCase().replace(/[^a-z0-9]/g, '');

const CANONICAL_BY_NORMALIZED = new Map<string, string>(
  CANONICAL_FIELDS.map((field) => [normalizeTagKey(field), field])
);

const EXTRA_ALIASES: Record<string, string> = {
  tracknumber: 'track',
  trackno: 'track',
  trck: 'track',
  tracktotal: 'track_total',
  totaltracks: 'track_total',
  trackcount: 'track_total',
  discnumber: 'disc',
  discno: 'disc',
  tpos: 'disc',
  disctotal: 'disc_total',
  totaldiscs: 'disc_total',
  disccount: 'disc_total',
  albumartist: 'album_artist',
  albumartistsort: 'album_artist_sort',
  titlesort: 'title_sort',
  albumsort: 'album_sort',
  artistsort: 'artist_sort',
  composersort: 'composer_sort',
  encodedby: 'encoded_by',
  tenc: 'encoded_by',
  tdrc: 'date',
  tyer: 'date',
  year: 'date',
  originaldate: 'original_date',
  releasedate: 'release_date',
  itunnorm: 'itunnorm',
  musicbrainztrackid: 'musicbrainz_trackid',
  musicbrainzrecordingid: 'musicbrainz_recordingid',
  musicbrainzalbumid: 'musicbrainz_albumid',
  musicbrainzreleaseid: 'musicbrainz_releaseid',
  musicbrainzreleasegroupid: 'musicbrainz_releasegroupid',
  musicbrainzartistid: 'musicbrainz_artistid',
  musicbrainzalbumartistid: 'musicbrainz_albumartistid',
  musicbrainzworkid: 'musicbrainz_workid',
  musicbrainztrmid: 'musicbrainz_trmid',
  musicbrainzdiscid: 'musicbrainz_discid',
  musicbrainzoriginalalbumid: 'musicbrainz_originalalbumid',
  r128trackgain: 'r128_track_gain',
  r128albumgain: 'r128_album_gain',
  initialkey: 'initial_key',
  episodeid: 'episode_id',
  seasonnumber: 'season_number',
  catalognumber: 'catalog_number',
  iswc: 'iswc',
};

const resolveCanonicalKey = (key: string): string | undefined => {
  const normalized = normalizeTagKey(key);
  return EXTRA_ALIASES[normalized] || CANONICAL_BY_NORMALIZED.get(normalized);
};

const isSafeMetaKey = (key: string): boolean => /^[A-Za-z0-9_.:-]+$/.test(key);

/**
 * Tags never copied from the source:
 * - container housekeeping that ffmpeg reports as tags (MP4 brands, handler
 *   names, vendor ids, creation time) and the source encoder name;
 * - iTunes gapless info (iTunSMPB): it describes the source encoder's
 *   priming/padding, so on a re-encoded file players would trim the wrong
 *   samples.
 */
const NEVER_COPIED_TAG_KEYS = new Set([
  'majorbrand',
  'minorversion',
  'compatiblebrands',
  'handlername',
  'vendorid',
  'creationtime',
  'encoder',
  'encoderoptions',
  'itunsmpb',
  'itunessmpb',
]);
const isNeverCopiedTagKey = (key: string): boolean =>
  NEVER_COPIED_TAG_KEYS.has(normalizeTagKey(key));

/** Formats whose tags are Vorbis comments (track total is its own field). */
const VORBIS_COMMENT_FORMATS = new Set(['ogg', 'flac']);

// Loop tags are never copied from the source: the worker writes them itself
// (converted for sample-rate changes, or omitted for 'skip'/unsupported
// formats). Passing the originals through would leave stale values behind,
// e.g. an unconverted LOOP_START next to the resampled loopstart for Opus.
const SOURCE_LOOP_TAG_KEYS = new Set([
  'loopstart',
  'looplength',
  'loopend',
  'itunesloopstart',
  'ituneslooplength',
  'itunesloopend',
]);
export const isLoopTagKey = (key: string): boolean =>
  SOURCE_LOOP_TAG_KEYS.has(normalizeTagKey(key));

export const sanitizeMetaValueForArgs = (raw: string): string =>
  String(raw)
    .split('\u0000')
    .join('')
    .replace(/\uFFFD/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, ' ')
    .trim();

const parseNumberAndTotal = (
  value: string
): { number: string; total: string } | null => {
  const slashMatch = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch?.[1] && slashMatch?.[2]) {
    return { number: slashMatch[1], total: slashMatch[2] };
  }
  const ofMatch = value.match(/^(\d+)\s*of\s*(\d+)$/i);
  if (ofMatch?.[1] && ofMatch?.[2]) {
    return { number: ofMatch[1], total: ofMatch[2] };
  }
  return null;
};

const replacementCharPattern = /\uFFFD/g;

const logMetadataCleanupWarning = (
  message: string,
  inputFile?: string
): void => {
  logger.error(message);
  // Worker threads have their own copy of utils' module state (no output
  // path, no chosen log file), so writing from here would spawn stray
  // logs(N).csv/error(N).csv files in the cwd. Hand the warning to the parent,
  // which owns the run's log files.
  const port =
    workerThreads.isMainThread === false ? workerThreads.parentPort : null;
  if (port) {
    port.postMessage({ type: 'warning', data: message });
    return;
  }
  void addToLog(
    { type: 'error', data: message },
    inputFile ? { inputFile, outputFile: '[metadata-cleanup]' } : undefined
  ).catch((error: unknown) => {
    logger.error(
      'Failed to write metadata cleanup warning to CSV logs:',
      error instanceof Error ? error.message : String(error)
    );
  });
};

const replacementCharCount = (value: string): number =>
  (value.match(replacementCharPattern) || []).length;

const shouldPreferCandidateValue = (
  currentValue: string,
  candidateValue: string
): boolean => {
  const currentReplacementCount = replacementCharCount(currentValue);
  const candidateReplacementCount = replacementCharCount(candidateValue);

  if (candidateReplacementCount !== currentReplacementCount) {
    return candidateReplacementCount < currentReplacementCount;
  }

  return false;
};

const collectNormalizedTags = (
  streamTags: Record<string, string> | undefined,
  formatTags: Record<string, string> | undefined
): {
  canonical: Map<string, string>;
  passthrough: Map<string, string>;
} => {
  const canonical = new Map<string, string>();
  const passthrough = new Map<string, string>();
  const seenNormalized = new Set<string>();

  const sources = [streamTags, formatTags];
  for (const tags of sources) {
    if (!tags) continue;
    for (const [key, value] of Object.entries(tags)) {
      if (value === undefined || value === null) continue;
      const rawValue = String(value);
      if (!rawValue && rawValue !== '0') continue;
      if (isNeverCopiedTagKey(key)) continue;
      // "und" (undetermined) is ffmpeg's placeholder, not a real language.
      if (normalizeTagKey(key) === 'language' && rawValue.trim() === 'und') {
        continue;
      }

      const canonicalKey = resolveCanonicalKey(key);
      if (canonicalKey) {
        if (canonicalKey === 'track' || canonicalKey === 'disc') {
          const parsed = parseNumberAndTotal(rawValue.trim());
          if (parsed) {
            const totalKey =
              canonicalKey === 'track' ? 'track_total' : 'disc_total';
            if (!canonical.has(canonicalKey)) {
              canonical.set(canonicalKey, parsed.number);
            }
            if (!canonical.has(totalKey)) {
              canonical.set(totalKey, parsed.total);
            }
            continue;
          }
        }

        if (!canonical.has(canonicalKey)) {
          canonical.set(canonicalKey, rawValue);
        } else {
          const existingValue = canonical.get(canonicalKey);
          if (
            typeof existingValue === 'string' &&
            shouldPreferCandidateValue(existingValue, rawValue)
          ) {
            canonical.set(canonicalKey, rawValue);
          }
        }
        continue;
      }

      const normalizedKey = normalizeTagKey(key);
      if (!seenNormalized.has(normalizedKey)) {
        seenNormalized.add(normalizedKey);
        passthrough.set(key, rawValue);
      } else {
        for (const [existingKey, existingValue] of passthrough.entries()) {
          if (normalizeTagKey(existingKey) !== normalizedKey) continue;
          if (!shouldPreferCandidateValue(existingValue, rawValue)) break;
          passthrough.delete(existingKey);
          passthrough.set(key, rawValue);
          break;
        }
      }
    }
  }

  return { canonical, passthrough };
};

/** ffprobe should answer in seconds; a FIFO or stalled network file would hang forever. */
const FFPROBE_TIMEOUT_MS = 60_000;
const FFPROBE_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * WAV loops usually live in the RIFF "smpl" chunk, which ffprobe ignores.
 * If a WAV has no loop tags, read that chunk and expose it as LOOPSTART /
 * LOOPLENGTH so the rest of the pipeline treats it like any other loop.
 */
const addWavSmplLoop = (metaData: AudioMetadata, inputFile: string): void => {
  if (!/\bwav\b/.test(String(metaData.format?.format_name ?? ''))) return;
  const hasLoopTag = [getAudioStream(metaData)?.tags, metaData.format?.tags]
    .flatMap((tags) => Object.keys(tags || {}))
    .some(isLoopTagKey);
  if (hasLoopTag) return;
  const loop = readWavSmplLoop(inputFile);
  if (!loop) return;
  if (!metaData.format) return;
  metaData.format.tags = {
    ...(metaData.format.tags || {}),
    LOOPSTART: String(loop.loopStart),
    LOOPLENGTH: String(loop.loopLength),
  };
};

// Get metaData from a file using ffprobe
const getMetaData = async (
  inputFile: string
): Promise<AudioMetadata | null> => {
  // Determine executable name based on platform
  const executableName = platformSlug === 'windows' ? 'ffprobe.exe' : 'ffprobe';
  const ffprobePath = findBinary(executableName, [
    `ffmpeg-bin/${platformSlug}`,
  ]);

  if (!ffprobePath) {
    logger.error(
      `${executableName} not found. Place it in ffmpeg-bin/${platformSlug}/`
    );
    return null;
  }

  try {
    const output = spawnSync(
      ffprobePath,
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        inputFile,
      ],
      {
        encoding: 'utf8',
        timeout: FFPROBE_TIMEOUT_MS,
        maxBuffer: FFPROBE_MAX_BUFFER,
      }
    );
    if (output.error) {
      throw output.error;
    }
    if (output.status !== 0) {
      throw new Error(
        output.stderr?.trim() || `ffprobe failed (code ${output.status})`
      );
    }
    if (!output.stdout) {
      throw new Error('ffprobe returned no output');
    }
    const metaData: AudioMetadata = JSON.parse(output.stdout);
    addWavSmplLoop(metaData, inputFile);
    return metaData;
  } catch (error: unknown) {
    logger.error(
      `Error running ${executableName}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
};

// Build metadata/channel args as arrays to avoid shell splitting issues
export const formatMetaDataArgs = (
  metaData: AudioMetadata | null,
  inputFile?: string,
  outputFormat?: string
): { metaDataArgs: string[]; channelsArgs: string[] } => {
  if (!metaData || !metaData.streams) {
    if (inputFile) logger.warn(`\n No metadata found in ${inputFile}`);
    return { metaDataArgs: [], channelsArgs: ['-ac', '2'] };
  }

  const audioStream = getAudioStream(metaData);
  const streamTags = audioStream?.tags;
  const formatTags = metaData.format?.tags;

  const { canonical, passthrough } = collectNormalizedTags(
    streamTags,
    formatTags
  );

  // Track/disc totals. ffmpeg has no output mapping for "track_total", so it
  // would be written as a stray custom tag. Vorbis comments (OGG/FLAC) have
  // their own TRACKTOTAL/DISCTOTAL fields; ID3 and MP4 store "3/12" in the
  // track field itself.
  const totalKeys: Record<string, string> = {};
  if (outputFormat) {
    const vorbis = VORBIS_COMMENT_FORMATS.has(outputFormat);
    for (const [field, totalField, vorbisKey] of [
      ['track', 'track_total', 'TRACKTOTAL'],
      ['disc', 'disc_total', 'DISCTOTAL'],
    ] as const) {
      const total = canonical.get(totalField);
      if (total === undefined) continue;
      canonical.delete(totalField);
      const number = canonical.get(field);
      if (vorbis) {
        totalKeys[vorbisKey] = total;
      } else if (number !== undefined) {
        canonical.set(field, `${number}/${total}`);
      }
    }
  }

  const metaDataArgs: string[] = [];
  for (const [key, value] of Object.entries(totalKeys)) {
    const clean = sanitizeMetaValueForArgs(value);
    if (clean) metaDataArgs.push('-metadata', `${key}=${clean}`);
  }
  for (const field of CANONICAL_FIELDS) {
    const raw = canonical.get(field);
    if (!raw && raw !== '0') continue;
    const rawString = String(raw);
    const clean = sanitizeMetaValueForArgs(rawString);
    if (rawString.includes('\uFFFD')) {
      logMetadataCleanupWarning(
        `Replacement character found in metadata tag "${field}"${inputFile ? ` for ${inputFile}` : ''}. Removed invalid character.`,
        inputFile
      );
      if (!clean && clean !== '0') {
        logMetadataCleanupWarning(
          `Metadata tag "${field}" became empty after replacement-character cleanup and was skipped.`,
          inputFile
        );
      }
    }
    if (!clean && clean !== '0') continue;
    metaDataArgs.push('-metadata', `${field}=${clean}`);
  }

  for (const [key, value] of passthrough.entries()) {
    if (!isSafeMetaKey(key) || isLoopTagKey(key)) continue;
    const rawString = String(value);
    const clean = sanitizeMetaValueForArgs(rawString);
    if (rawString.includes('\uFFFD')) {
      logMetadataCleanupWarning(
        `Replacement character found in metadata tag "${key}"${inputFile ? ` for ${inputFile}` : ''}. Removed invalid character.`,
        inputFile
      );
      if (!clean && clean !== '0') {
        logMetadataCleanupWarning(
          `Metadata tag "${key}" became empty after replacement-character cleanup and was skipped.`,
          inputFile
        );
      }
    }
    if (!clean && clean !== '0') continue;
    metaDataArgs.push('-metadata', `${key}=${clean}`);
  }

  const ch = audioStream?.channels ? String(audioStream.channels) : '2';
  const channelsArgs = ['-ac', ch];
  return { metaDataArgs, channelsArgs };
};

type LoopPoints = {
  loopStart: number;
  loopLength: number;
  /** The source described its loop with LOOPEND, so write one back too. */
  hasLoopEnd?: boolean;
};

/** A loop value: a whole, non-negative sample count ("100.9" reads as 100). */
const parseLoopValue = (raw: unknown): number => {
  const text = String(raw ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return NaN;
  const value = Math.floor(Number(text));
  return Number.isSafeInteger(value) ? value : NaN;
};

// Get loop points from metaData. Tag names are matched ignoring case and
// separators (LOOPSTART, LoopStart, LOOP_START, loop-start, iTunes_LOOPSTART),
// stream tags first, then format tags.
export const getLoopPoints = (
  metaData: AudioMetadata | null | undefined,
  inputFile?: string
): LoopPoints => {
  if (!metaData) return { loopStart: NaN, loopLength: NaN };

  const found = new Map<string, string>();
  for (const tags of [getAudioStream(metaData)?.tags, metaData.format?.tags]) {
    for (const [key, value] of Object.entries(tags || {})) {
      const normalized = normalizeTagKey(key).replace(/^itunes/, '');
      if (!found.has(normalized) && value !== undefined && value !== null) {
        found.set(normalized, String(value));
      }
    }
  }

  const read = (name: string): number => {
    const raw = found.get(name);
    if (raw === undefined) return NaN;
    const value = parseLoopValue(raw);
    if (Number.isNaN(value)) {
      logMetadataCleanupWarning(
        `Ignored invalid loop tag ${name.toUpperCase()}="${raw}"${inputFile ? ` in ${inputFile}` : ''} (expected a whole, non-negative sample number).`,
        inputFile
      );
    }
    return value;
  };

  const loopStart = read('loopstart');
  let loopLength = read('looplength');
  const loopEnd = read('loopend');
  const hasLoopEnd = !Number.isNaN(loopEnd);

  // LOOPEND (exclusive end sample) instead of LOOPLENGTH.
  if (Number.isNaN(loopLength) && hasLoopEnd && !Number.isNaN(loopStart)) {
    loopLength = loopEnd > loopStart ? loopEnd - loopStart : NaN;
  }

  return hasLoopEnd
    ? { loopStart, loopLength, hasLoopEnd }
    : { loopStart, loopLength };
};

/** Sample rates each encoder can write; anything else is resampled by ffmpeg. */
const MP3_RATES = [
  8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000,
];
const AAC_RATES = [
  7350, 8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 64000,
  88200, 96000,
];

/** Closest rate an encoder supports: the input rate if allowed, else the next one up, else its maximum. */
const pickSupportedRate = (inputRate: number, rates: number[]): number => {
  if (rates.includes(inputRate)) return inputRate;
  return rates.find((rate) => rate >= inputRate) ?? rates[rates.length - 1]!;
};

/**
 * The sample rate the output will be written at. Opus always decodes at
 * 48 kHz, so it is always encoded at 48 kHz too — that way loop tags are in
 * the same units a player sees. MP3 and AAC have fixed rate lists.
 */
export const outputSampleRateFor = (
  inputRate: number,
  outputFormat: string,
  oggCodec: string
): number => {
  if (outputFormat === 'ogg' && oggCodec === 'opus') return 48000;
  if (outputFormat === 'mp3') return pickSupportedRate(inputRate, MP3_RATES);
  if (outputFormat === 'm4a') return pickSupportedRate(inputRate, AAC_RATES);
  return inputRate;
};

// Convert loop points for different sample rates
export const convertLoopPoints = (
  metaData: AudioMetadata | null,
  outputFormat: string,
  oggCodec: string,
  inputFile?: string
): {
  newSampleRate: number | null;
  loopStart: number;
  loopLength: number;
  hasLoopEnd?: boolean;
} => {
  const audioStream = getAudioStream(metaData);
  if (!metaData || !audioStream) {
    return {
      newSampleRate: null,
      loopStart: NaN,
      loopLength: NaN,
    };
  }

  const loops = getLoopPoints(metaData, inputFile);
  const extra = loops.hasLoopEnd ? { hasLoopEnd: true } : {};

  const sampleRate = audioStream.sample_rate;
  const inputSampleRate = sampleRate
    ? Number.parseInt(String(sampleRate), 10)
    : NaN;
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
    return {
      newSampleRate:
        outputFormat === 'ogg' && oggCodec === 'opus' ? 48000 : null,
      loopStart: loops.loopStart,
      loopLength: loops.loopLength,
      ...extra,
    };
  }

  const outputSampleRate = outputSampleRateFor(
    inputSampleRate,
    outputFormat,
    oggCodec
  );
  const isOpusConversion = outputFormat === 'ogg' && oggCodec === 'opus';

  // Scale loop points to the output rate (NaN stays NaN).
  const ratio = outputSampleRate / inputSampleRate;
  const scale = (value: number) =>
    Number.isNaN(value) ? NaN : Math.round(value * ratio);

  return {
    // Opus always gets an explicit -ar; other formats only when the rate changes.
    newSampleRate:
      isOpusConversion || outputSampleRate !== inputSampleRate
        ? outputSampleRate
        : null,
    loopStart: scale(loops.loopStart),
    loopLength: scale(loops.loopLength),
    ...extra,
  };
};

/**
 * ffmpeg args for loop tags. Written once each, in upper case: ffmpeg's tag
 * dictionary ignores case, so writing LOOPSTART and loopstart would leave
 * only the last spelling. LOOPSTART alone (no length) is kept as-is.
 */
export const formatLoopData = (
  loopStart: number,
  loopLength: number,
  includeLoopEnd = false
): string[] => {
  if (Number.isNaN(loopStart)) return [];
  const args = ['-metadata', `LOOPSTART=${loopStart}`];
  if (!Number.isNaN(loopLength)) {
    args.push('-metadata', `LOOPLENGTH=${loopLength}`);
    if (includeLoopEnd) {
      args.push('-metadata', `LOOPEND=${loopStart + loopLength}`);
    }
  }
  return args;
};

/**
 * ffmpeg args that delete every loop tag found in the source. Needed when the
 * output keeps source metadata (AIFF) but loop data must be dropped ('skip').
 */
export const clearSourceLoopTagArgs = (
  metaData: AudioMetadata | null
): string[] => {
  const keys = new Set<string>();
  for (const tags of [getAudioStream(metaData)?.tags, metaData?.format?.tags]) {
    for (const key of Object.keys(tags || {})) {
      if (isLoopTagKey(key) && isSafeMetaKey(key)) keys.add(key);
    }
  }
  return [...keys].flatMap((key) => ['-metadata', `${key}=`]);
};

export { getMetaData };
