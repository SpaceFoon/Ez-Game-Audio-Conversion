//metaDataService.ts
import type { AudioMetadata } from './types/metadata.js';

import { spawnSync } from 'child_process';
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
  'encoder',
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
  'itunessmpb',
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
  itunessmpb: 'itunessmpb',
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

export const sanitizeMetaValueForArgs = (raw: string): string =>
  String(raw)
    .split('\u0000')
    .join('')
    .replace(/\uFFFD/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
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
      { encoding: 'utf8' }
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
  inputFile?: string
): { metaDataArgs: string[]; channelsArgs: string[] } => {
  if (!metaData || !metaData.streams) {
    if (inputFile) logger.warn(`\n No metadata found in ${inputFile}`);
    return { metaDataArgs: [], channelsArgs: ['-ac', '2'] };
  }

  const streamTags = metaData.streams[0]?.tags;
  const formatTags = metaData.format?.tags;

  const { canonical, passthrough } = collectNormalizedTags(
    streamTags,
    formatTags
  );

  const metaDataArgs: string[] = [];
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
    if (!isSafeMetaKey(key)) continue;
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

  const ch = metaData.streams[0]?.channels
    ? String(metaData.streams[0].channels)
    : '2';
  const channelsArgs = ['-ac', ch];
  return { metaDataArgs, channelsArgs };
};

// Get loop points from metaData
export const getLoopPoints = (metaData: AudioMetadata | null | undefined) => {
  if (!metaData) return { loopStart: NaN, loopLength: NaN };

  // Helper function to check multiple tag variants
  const getTagValue = (tagName: string) => {
    const variants = [
      tagName, // LOOPSTART
      tagName.toLowerCase(), // loopstart
      `LOOP_${tagName.replace('LOOP', '')}`, // LOOP_START
      `loop_${tagName.replace(/^LOOP/i, '').toLowerCase()}`, // loop_start
      `iTunes_${tagName}`, // iTunes_LOOPSTART
      `itunes_${tagName.toLowerCase()}`, // itunes_loopstart
    ];

    for (const variant of variants) {
      // Check stream tags
      if (
        metaData.streams &&
        metaData.streams[0]?.tags &&
        metaData.streams[0].tags[variant] !== undefined
      ) {
        return metaData.streams[0].tags[variant];
      }

      // Check format tags
      if (
        metaData.format &&
        metaData.format.tags &&
        metaData.format.tags[variant] !== undefined
      ) {
        return metaData.format.tags[variant];
      }
    }

    return null;
  };

  const loopStartRaw = getTagValue('LOOPSTART');
  const loopLengthRaw = getTagValue('LOOPLENGTH');

  const loopStart = loopStartRaw ? parseInt(loopStartRaw, 10) : NaN;
  const loopLength = loopLengthRaw ? parseInt(loopLengthRaw, 10) : NaN;

  return { loopStart, loopLength };
};

// Convert loop points for different sample rates
export const convertLoopPoints = (
  metaData: AudioMetadata | null,
  outputFormat: string,
  oggCodec: string
) => {
  if (!metaData || !metaData.streams || !metaData.streams[0]) {
    return {
      newSampleRate: null,
      loopStart: NaN,
      loopLength: NaN,
    };
  }

  // Get original values
  const sampleRate = metaData.streams[0].sample_rate;
  const { loopStart, loopLength } = getLoopPoints(metaData);

  const inputSampleRate = sampleRate
    ? Number.parseInt(String(sampleRate), 10)
    : NaN;
  if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
    return {
      newSampleRate: null,
      loopStart,
      loopLength,
    };
  }

  // If no valid loop points, return early
  if (isNaN(loopStart) || isNaN(loopLength)) {
    return {
      newSampleRate: null,
      loopStart,
      loopLength,
    };
  }

  // Determine output sample rate based on format requirements
  let outputSampleRate = inputSampleRate; // Default: preserve input rate
  let isOpusConversion = false;

  // Opus requires specific sample rates, so we must convert
  if (outputFormat === 'ogg' && oggCodec === 'opus') {
    isOpusConversion = true;
    if (inputSampleRate >= 32000) {
      outputSampleRate = 48000;
    } else if (inputSampleRate > 16000) {
      outputSampleRate = 24000;
    } else if (inputSampleRate > 12000) {
      outputSampleRate = 16000;
    } else if (inputSampleRate > 8000) {
      outputSampleRate = 12000;
    } else {
      outputSampleRate = 8000;
    }
  }
  // Other formats: add explicit sample rate handling here if needed in future

  // Calculate ratio and adjust loop points if sample rate differs
  const ratio = outputSampleRate / inputSampleRate;
  const convertedLoopStart = Math.round(loopStart * ratio);
  const convertedLoopLength = Math.round(loopLength * ratio);

  // For Opus, always return the sample rate (ffmpeg needs explicit -ar flag)
  // For other formats, only return it if it actually changed
  const shouldReturnSampleRate =
    isOpusConversion || outputSampleRate !== inputSampleRate;

  return {
    newSampleRate: shouldReturnSampleRate ? outputSampleRate : null,
    loopStart: convertedLoopStart,
    loopLength: convertedLoopLength,
  };
};

// Format loop data for ffmpeg command
export const formatLoopData = (loopStart: number, loopLength: number) => {
  if (Number.isNaN(loopStart) || Number.isNaN(loopLength)) return [];

  // Only include the standard variants that are most widely supported.
  return [
    '-metadata',
    `LOOPSTART=${loopStart}`,
    '-metadata',
    `LOOPLENGTH=${loopLength}`,
    '-metadata',
    `loopstart=${loopStart}`,
    '-metadata',
    `looplength=${loopLength}`,
  ];
};

export { getMetaData };
