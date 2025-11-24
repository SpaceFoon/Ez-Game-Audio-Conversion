import { spawnSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
// Get metaData from a file using ffprobe
const getMetaData = async (inputFile) => {
    try {
        // Determine executable name based on platform
        const executableName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
        const devPath = join(process.cwd(), executableName);
        const binPath = join(process.cwd(), 'bin', executableName);
        // Prefer dev path if present, otherwise try bin path (do not gate on exists for test predictability)
        let ffprobePath = existsSync(devPath) ? devPath : binPath;
        const output = spawnSync(ffprobePath, [
            '-v',
            'quiet',
            '-print_format',
            'json',
            '-show_format',
            '-show_streams',
            inputFile,
        ], { encoding: 'utf8' });
        if (output.error)
            throw output.error;
        if (!output.stdout)
            throw new Error('ffprobe returned no output');
        const metaData = JSON.parse(output.stdout);
        return metaData;
    }
    catch (error) {
        // Keep this lightweight for tests: don't import utils/addToLog here
        // Standardize error message to match tests
        console.error('Error running ffprobe.exe:', error.message || String(error));
        return null;
    }
};
// Extract metaData fields from tags
const formatMetaDataField = (streamTags, formatTags, field) => {
    if (!streamTags && !formatTags)
        return '';
    const tagVariants = [field.toLowerCase(), field.toUpperCase()];
    for (const tag of tagVariants) {
        if (streamTags && streamTags[tag])
            return streamTags[tag];
        if (formatTags && formatTags[tag])
            return formatTags[tag];
    }
    return '';
};
// Format metaData for ffmpeg command (legacy string version)
const formatMetaData = (metaData, inputFile) => {
    if (!metaData || !metaData.streams) {
        if (inputFile) {
            console.warn(`\n No meta data found in ${inputFile}`);
        }
        // Maintain legacy spacing contract: channels string includes leading space
        return { metaData: '', channels: ' -ac 2' };
    }
    let streamTags = metaData.streams[0]?.tags || {};
    let formatTags = metaData.format?.tags || {};
    const metaDataFields = [
        // Basic fields
        'title',
        'artist',
        'album',
        'album_artist',
        'track',
        'tracknumber',
        'tracktotal',
        'disc',
        'discnumber',
        'disctotal',
        'genre',
        'date',
        'year',
        'composer',
        'lyricist',
        'lyrics',
        'comment',
        'description',
        'subtitle',
        'grouping',
        'language',
        'bpm',
        'mood',
        'rating',
        'isrc',
        'encoder',
        'encoded_by',
        'publisher',
        'copyright',
        'compilation',
        // ReplayGain / loudness
        'replaygain_track_gain',
        'replaygain_track_peak',
        'replaygain_album_gain',
        'replaygain_album_peak',
        // iTunes-specific
        'itunesadvisory', // explicit flag (0=none, 1=clean, 2=explicit)
        'itunesalbumid',
        'itunesartistid',
        'itunescomposerid',
        'itunesgenreid',
        'itunespodcast', // "1" for podcast
        'itunesseason',
        'itunesepisode',
        'itunesepisodetype', // full/trailer/bonus
        'itunesauthor',
        'itunescopyright',
        'ituneskeywords',
        'itunesu', // for iTunes U
        // Podcast-specific
        'podcastid',
        'podcasturl',
        'podcastfeed',
        'podcastdesc',
        'podcastkeywords',
        'podcastauthor',
        'podcastsubtitle',
        // Others
        'media_type', // e.g. "audio"
        'category',
        'license',
        'website',
        'original_artist',
        'original_album',
        'original_year',
        'source',
        'label',
        'encodedby',
        'barcode',
        'catalog_number',
        'location', // GPS or descriptive
        'performer',
        'conductor',
        'engineer',
        'remixer',
        'mixartist',
        'arranger',
        'producer',
        'director',
        'commenter',
    ];
    const metaDataDataArray = [];
    metaDataFields.forEach((field) => {
        if (!field)
            return;
        const rawValue = formatMetaDataField(streamTags, formatTags, field);
        // because you can break the entire ffmpegCommand with meta data
        const cleanValue = rawValue
            .split('\u0000')
            .join('') // remove null bytes
            .replace(/\\/g, '\\\\') // escape backslashes
            .replace(/"/g, '\\"') // escape double quotes
            .replace(/\r\n/g, '\\n') // replace Windows newlines with \n
            .replace(/\n/g, '\\n') // replace Unix newlines with \n
            .replace(/\r/g, '\\n') // replace Old Mac newlines with \n
            .trim();
        if (cleanValue) {
            // Normalize name of track to trackNumber
            const adjustedField = field === 'track' ? 'trackNumber' : field;
            // Format properly with proper quoting and escaping
            metaDataDataArray.push(`-metadata ${adjustedField}="${cleanValue}"`);
        }
    });
    const channels = metaData.streams[0]
        ? ` -ac ${metaData.streams[0].channels}`
        : ' -ac 2';
    const metaDataString = metaDataDataArray.join(' ');
    if (process.env['DEBUG']) {
        console.log('10 metaDataarray metadataService line 173: ', metaDataDataArray);
    }
    return { metaData: metaDataString, channels };
};
// New: Build metadata/channel args as arrays to avoid shell splitting issues
export const formatMetaDataArgs = (metaData, inputFile) => {
    if (!metaData || !metaData.streams) {
        if (inputFile)
            console.warn(`\n No meta data found in ${inputFile}`);
        return { metaDataArgs: [], channelsArgs: ['-ac', '2'] };
    }
    const streamTags = metaData.streams[0]?.tags || {};
    const formatTags = metaData.format?.tags || {};
    const fields = [
        'title',
        'artist',
        'album',
        'album_artist',
        'track',
        'tracknumber',
        'tracktotal',
        'disc',
        'discnumber',
        'disctotal',
        'genre',
        'date',
        'year',
        'composer',
        'lyricist',
        'lyrics',
        'comment',
        'description',
        'subtitle',
        'grouping',
        'language',
        'bpm',
        'mood',
        'rating',
        'isrc',
        'encoder',
        'encoded_by',
        'publisher',
        'copyright',
        'compilation',
        'replaygain_track_gain',
        'replaygain_track_peak',
        'replaygain_album_gain',
        'replaygain_album_peak',
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
        'podcastid',
        'podcasturl',
        'podcastfeed',
        'podcastdesc',
        'podcastkeywords',
        'podcastauthor',
        'podcastsubtitle',
        'media_type',
        'category',
        'license',
        'website',
        'original_artist',
        'original_album',
        'original_year',
        'source',
        'label',
        'encodedby',
        'barcode',
        'catalog_number',
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
    ];
    const metaDataArgs = [];
    for (const field of fields) {
        const raw = formatMetaDataField(streamTags, formatTags, field) || '';
        const clean = raw
            .split('\u0000')
            .join('')
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r\n/g, '\\n')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\n')
            .trim();
        if (!clean)
            continue;
        const key = field === 'track' ? 'trackNumber' : field;
        metaDataArgs.push('-metadata', `${key}=${clean}`);
    }
    const ch = metaData.streams[0]?.channels
        ? String(metaData.streams[0].channels)
        : '2';
    const channelsArgs = ['-ac', ch];
    return { metaDataArgs, channelsArgs };
};
// Get loop points from metaData
export const getLoopPoints = (metaData) => {
    if (!metaData)
        return { loopStart: NaN, loopLength: NaN };
    // Helper function to check multiple tag variants
    const getTagValue = (tagName) => {
        const variants = [
            tagName, // LOOPSTART
            tagName.toLowerCase(), // loopstart
            `LOOP_${tagName.replace('LOOP', '')}`, // LOOP_START
            `loop_${tagName.replace('loop', '')}`, // loop_start
            `iTunes_${tagName}`, // iTunes_LOOPSTART
            `itunes_${tagName}`, // itunes_loopstart
        ];
        for (const variant of variants) {
            // Check stream tags
            if (metaData.streams &&
                metaData.streams[0]?.tags &&
                metaData.streams[0].tags[variant] !== undefined) {
                return metaData.streams[0].tags[variant];
            }
            // Check format tags
            if (metaData.format &&
                metaData.format.tags &&
                metaData.format.tags[variant] !== undefined) {
                return metaData.format.tags[variant];
            }
        }
        return null;
    };
    const loopStart = parseInt(getTagValue('LOOPSTART') || null);
    const loopLength = parseInt(getTagValue('LOOPLENGTH') || null);
    return { loopStart, loopLength };
};
// Convert loop points for different sample rates
export const convertLoopPoints = (metaData, outputFormat, oggCodec) => {
    if (!metaData || !metaData.streams) {
        return {
            newSampleRate: null,
            loopStart: NaN,
            loopLength: NaN,
        };
    }
    // Get original values
    const sampleRate = metaData.streams[0].sample_rate;
    const { loopStart, loopLength } = getLoopPoints(metaData);
    // console.log("convertLoopPoints - Original values:", {
    //   sampleRate,
    //   loopStart,
    //   loopLength,
    // });
    // If not converting to opus or no valid loop points, return original values
    if (outputFormat !== 'ogg' ||
        oggCodec !== 'opus' ||
        isNaN(loopStart) ||
        isNaN(loopLength)) {
        return {
            newSampleRate: null,
            loopStart,
            loopLength,
        };
    }
    // Convert sample rate for opus
    const sampleRateNumber = parseInt(sampleRate);
    let newSampleRate = null;
    if (sampleRateNumber >= 32000) {
        newSampleRate = 48000;
    }
    else if (sampleRateNumber >= 22050) {
        newSampleRate = 24000;
    }
    else if (sampleRateNumber > 16000) {
        newSampleRate = 24000;
    }
    else if (sampleRateNumber > 12000) {
        newSampleRate = 16000;
    }
    else if (sampleRateNumber >= 8000) {
        newSampleRate = 12000;
    }
    else if (sampleRateNumber < 8000) {
        newSampleRate = 8000;
    }
    // Convert loop points based on sample rate change
    const ratio = (newSampleRate || sampleRateNumber) / sampleRateNumber;
    const convertedLoopStart = Math.round(loopStart * ratio);
    const convertedLoopLength = Math.round(loopLength * ratio);
    if (process.env.DEBUG) {
        console.log('convertLoopPoints - Conversion:', {
            oldSampleRate: sampleRateNumber,
            newSampleRate,
            ratio,
            oldLoopStart: loopStart,
            newLoopStart: convertedLoopStart,
            oldLoopLength: loopLength,
            newLoopLength: convertedLoopLength,
        });
    }
    return {
        newSampleRate,
        loopStart: convertedLoopStart,
        loopLength: convertedLoopLength,
    };
};
// Format loop data for ffmpeg command
export const formatLoopData = (loopStart, loopLength) => {
    if (isNaN(loopStart) || isNaN(loopLength))
        return '';
    // Only include the standard variants that are most widely supported
    return (` -metadata LOOPSTART=${loopStart} -metadata LOOPLENGTH=${loopLength} ` +
        `-metadata loopstart=${loopStart} -metadata looplength=${loopLength}`);
};
export { getMetaData, formatMetaDataField, formatMetaData, };
//# sourceMappingURL=metadataService.js.map