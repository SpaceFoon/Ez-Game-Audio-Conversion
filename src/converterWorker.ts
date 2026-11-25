// converterWorker.ts
// Worker runs ffprobe to get metadata, then ffmpeg to convert one file.
import { spawn } from 'child_process';
import { workerData, parentPort } from 'worker_threads';
import { dirname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import {
  getMetaData,
  formatMetaDataArgs,
  convertLoopPoints,
  formatLoopData,
  clearSourceLoopTagArgs,
} from './metadataService.js';
import { getAudioStream } from './audioStream.js';
import { platformSlug, getErrorMessage, findBinary } from './utils.js';
import { removeIfWrittenSince } from './fileCleanup.js';
import { writeWavSmplLoop } from './wavLoops.js';
import { isCaseInsensitiveDir } from './pathKey.js';
import logger from './logger.js';
import type { LoopDataMode } from './types/settings.js';

/**
 * Returns true when the output path can't be used as a filename.
 * Control characters are rejected everywhere. The Windows-reserved characters
 * (<>:"|?*) are only rejected on Windows — they are legal on Linux and macOS,
 * so names like "Track 01: Intro" must still convert there.
 */
export const outputPathHasInvalidCharacters = (
  outputFile: string,
  platform: string = platformSlug
): boolean => {
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F]/.test(outputFile)) return true;
  if (platform !== 'windows') return false;

  const pathToCheck = /^[A-Za-z]:/.test(outputFile)
    ? outputFile.slice(2)
    : outputFile;
  return /[<>:"|?*]/.test(pathToCheck);
};

type WorkerFileContext = {
  inputFile?: string;
  outputFile?: string;
};

type WorkerErrorMessage = {
  type: 'error';
  data: string;
  file?: WorkerFileContext;
};

// Helper function for failures — posts to parent, then rejects (no throw after postMessage)
const failWorker = (reason: unknown): Promise<never> => {
  const f = (workerData && workerData.file) || {};
  postError(reason, { inputFile: f.inputFile, outputFile: f.outputFile });
  const msg =
    reason instanceof Error
      ? reason.message
      : String(reason || 'Unknown error');
  return Promise.reject(new Error(msg));
};

// Set once any error has been posted, so the top-level catch only reports
// failures nothing else has explained (e.g. an unexpected throw).
let errorPosted = false;

// Send structured error to manager (no hard exit here; allow caller to throw/reject)
const postError = (reason: unknown, fileCtx: WorkerFileContext = {}) => {
  errorPosted = true;
  const msg =
    reason instanceof Error
      ? reason.message
      : String(reason || 'Unknown error');
  try {
    const file: WorkerFileContext = {};
    if (typeof fileCtx.inputFile === 'string')
      file.inputFile = fileCtx.inputFile;
    if (typeof fileCtx.outputFile === 'string')
      file.outputFile = fileCtx.outputFile;

    const payload: WorkerErrorMessage = {
      type: 'error',
      data: msg,
      ...(Object.keys(file).length ? { file } : {}),
    };
    parentPort?.postMessage(payload);
  } catch {
    // ignored
  }
};

const converterWorker = async ({
  file: { inputFile, outputFile, outputFormat },
  settings: { oggCodec, loopDataMode = 'auto' },
}: {
  file: { inputFile: string; outputFile: string; outputFormat: string };
  settings: { oggCodec: string; loopDataMode?: LoopDataMode };
}): Promise<void> => {
  // Basic validation to prevent crashes
  if (!inputFile) {
    return failWorker('Missing input file');
  }

  if (!outputFile) {
    return failWorker('Missing output file');
  }

  if (!outputFormat) {
    return failWorker('Missing output format');
  }

  // Validate output file path
  if (platformSlug === 'windows' && outputFile.includes('"')) {
    return failWorker(
      `Output file path contains quotes which will cause problems: ${outputFile}`
    );
  }

  if (outputFile.includes('\n') || outputFile.includes('\r')) {
    return failWorker(`Output file path contains line breaks: ${outputFile}`);
  }

  if (outputPathHasInvalidCharacters(outputFile)) {
    return failWorker(
      `Output file path contains invalid characters (control chars${platformSlug === 'windows' ? ' or <>:|?*' : ''}): ${outputFile}`
    );
  }

  // Output path too long check (Windows MAX_PATH limitation)
  if (outputFile.length > 250) {
    logger.warn(
      `⚠️ Output path is very long (${outputFile.length} chars), might cause issues on Windows`
    );
  }

  // Defense in depth: never allow ffmpeg -y to overwrite the source file.
  // The upstream guard in createConversionList should prevent this, but if
  // anything slips through, this hard stop protects the user's data.
  const sameIgnoringCase =
    resolve(inputFile).toLowerCase() === resolve(outputFile).toLowerCase();
  if (
    resolve(inputFile) === resolve(outputFile) ||
    (sameIgnoringCase && isCaseInsensitiveDir(dirname(resolve(inputFile))))
  ) {
    return failWorker(
      `CRITICAL: output path resolves to input file — refusing to overwrite: ${inputFile}`
    );
  }

  // Get metadata from input file
  const metadata = await getMetaData(inputFile);
  if (metadata === null) {
    return failWorker(
      `Could not read metadata from input file (ffprobe failed): ${inputFile}`
    );
  }
  if (!getAudioStream(metadata)) {
    return failWorker(`Input file has no audio stream: ${inputFile}`);
  }

  // Get formatted metadata and channels as arrays (safe for spawn)
  const { metaDataArgs, channelsArgs } = formatMetaDataArgs(
    metadata,
    inputFile,
    outputFormat
  );

  // Convert loop points if needed
  const { newSampleRate, loopStart, loopLength, hasLoopEnd } =
    convertLoopPoints(metadata, outputFormat, oggCodec, inputFile);

  // Build sample rate args for ffmpeg command
  const sampleRateArgs = newSampleRate ? ['-ar', String(newSampleRate)] : [];

  // Format loop data for ffmpeg command
  let loopDataArgs: string[] = [];
  // WAV has no tag field for loops; "force" writes a smpl chunk after ffmpeg.
  let wavSmplLoop: { loopStart: number; loopLength: number } | null = null;
  if (loopDataMode === 'skip') {
    loopDataArgs = [];
  } else if (
    !isNaN(loopStart) &&
    !(loopStart === 0 && (loopLength === 0 || isNaN(loopLength)))
  ) {
    const fmt = outputFormat.toLowerCase();
    const unsupportedFormat = fmt === 'm4a' || fmt === 'wav';
    if (unsupportedFormat && loopDataMode !== 'force') {
      logger.log(
        `Loop points are not supported for ${fmt.toUpperCase()} format`
      );
      loopDataArgs = [];
    } else if (fmt === 'wav') {
      wavSmplLoop = { loopStart, loopLength };
    } else {
      loopDataArgs = formatLoopData(loopStart, loopLength, hasLoopEnd);
      // The MP4 writer drops custom tags unless told to keep them.
      if (fmt === 'm4a') loopDataArgs.push('-movflags', 'use_metadata_tags');
    }
  }

  // Find bundled ffmpeg executable
  const executableName = platformSlug === 'windows' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffmpegPath = findBinary(executableName, [`ffmpeg-bin/${platformSlug}`]);

  if (ffmpegPath === null) {
    return failWorker(
      `${executableName} not found. Place it in ffmpeg-bin/${platformSlug}/`
    );
  }
  const resolvedFfmpegPath = ffmpegPath!;

  // Despite what you read online these are the best codecs. WAV and AIFF codecs were chosen for common game engine compatibility.
  // https://trac.ffmpeg.org/wiki/TheoraVorbisEncodingGuide
  // https://trac.ffmpeg.org/wiki/Encode/MP3
  // https://trac.ffmpeg.org/wiki/Encode/AAC page is wrong about aac being experimental.
  // -b:a = constant bitrate -q:a = variable which saves space.

  const formatConfig = {
    ogg: {
      vorbis: {
        codec: 'libvorbis',
        additionalOptions: ['-q:a', '1.2'],
      },
      opus: {
        codec: 'libopus',
        additionalOptions: ['-b:a', '64k'], //-b:a = variable in this case...
      },
    },
    mp3: { codec: 'libmp3lame', additionalOptions: ['-q:a', '4'] }, //-V 4	165average	140-188 range
    wav: {
      codec: 'pcm_s16le',
    },
    m4a: {
      codec: 'aac',
      // Use simpler options for M4A to avoid errors
      additionalOptions: ['-b:a', '256k'], // Fixed bitrate is more reliable
      preserveMetadata: false, // Try without preserving metadata first
    },
    aiff: {
      codec: 'pcm_s16le',
      // Write tags as ID3. Tags are rebuilt like every other format: copying
      // them through would lose OGG/Opus tags, which ffmpeg keeps per stream
      // while the AIFF writer only reads file-level tags.
      additionalOptions: ['-write_id3v2', '1'],
    },
    flac: { codec: 'flac', additionalOptions: ['-compression_level', '1'] }, //Minimal compression but 30% smaller than without.
  };

  type FormatConfig = {
    codec: string;
    additionalOptions?: string[];
    preserveMetadata?: boolean;
  };

  const getFormatConfig = (
    outputFormat: string,
    oggCodec: string
  ): FormatConfig => {
    if (outputFormat === 'ogg') {
      if (oggCodec !== 'opus' && oggCodec !== 'vorbis') {
        throw new Error(`Unsupported ogg codec: ${oggCodec}`);
      }
      const cfg = (formatConfig.ogg as Record<string, FormatConfig>)[oggCodec];
      if (!cfg) throw new Error(`Unsupported ogg codec: ${oggCodec}`);
      return cfg;
    }

    const table: Record<string, FormatConfig> = {
      mp3: formatConfig.mp3,
      wav: formatConfig.wav,
      m4a: formatConfig.m4a,
      aiff: formatConfig.aiff,
      flac: formatConfig.flac,
    };

    const cfg = table[outputFormat];
    if (!cfg) {
      throw new Error(`Unsupported output format: ${outputFormat}`);
    }
    return cfg;
  };

  const {
    codec,
    additionalOptions = [],
    preserveMetadata = false,
  } = getFormatConfig(outputFormat, oggCodec);

  // Build the command arguments array
  // -xerror: stop at the first decode error, so a corrupt or truncated input
  // fails instead of "succeeding" with missing audio.
  const ffmpegArgs: string[] = [
    '-loglevel',
    'error',
    '-xerror',
    '-i',
    inputFile,
  ];

  // Only use -map_metadata -1 if we don't need to preserve original metadata
  if (!preserveMetadata) {
    ffmpegArgs.push('-map_metadata', '-1');
  }
  // '-c:a' means copy audio streams only.
  // Add codec
  ffmpegArgs.push('-c:a', codec);

  // Add additional options
  if (additionalOptions && additionalOptions.length) {
    ffmpegArgs.push(...additionalOptions);
  }

  // Add sample rate if specified
  if (sampleRateArgs.length) {
    ffmpegArgs.push(...sampleRateArgs);
  }

  // FLAC keeps the source bit depth. Without this, lossy and 8/16-bit sources
  // decode to float and come out as 24-bit FLAC: bigger, with no added detail.
  if (outputFormat === 'flac') {
    const stream = getAudioStream(metadata);
    const bits = Number(
      stream?.bits_per_raw_sample || stream?.bits_per_sample || 0
    );
    if (!(bits > 16)) ffmpegArgs.push('-sample_fmt', 's16');
  }

  // Add basic options
  ffmpegArgs.push('-vn', '-y');

  // Add metadata args only when metadata is being rebuilt.
  // For preserveMetadata formats (AIFF), ffmpeg keeps source metadata;
  // re-applying all tags can create duplicate/conflicting entries.
  if (!preserveMetadata && metaDataArgs && metaDataArgs.length) {
    ffmpegArgs.push(...metaDataArgs);
  }

  // Formats that keep source metadata would otherwise carry the original loop
  // tags through even when loop data is meant to be dropped.
  if (preserveMetadata && loopDataMode === 'skip') {
    ffmpegArgs.push(...clearSourceLoopTagArgs(metadata));
  }

  // Add loop metadata args
  if (loopDataArgs.length) {
    ffmpegArgs.push(...loopDataArgs);
  }

  // Add channels args. MP3 (LAME) only encodes mono/stereo, so a surround
  // source must be downmixed rather than forcing its channel count.
  if (channelsArgs && channelsArgs.length) {
    const channelCount = Number(channelsArgs[channelsArgs.indexOf('-ac') + 1]);
    if (outputFormat === 'mp3' && channelCount > 2) {
      ffmpegArgs.push('-ac', '2');
    } else {
      ffmpegArgs.push(...channelsArgs);
      // libopus's default surround mapping rejects every 3- and 4-channel
      // layout (and anything over 8). Mapping family 255 stores the channels
      // as-is, so the conversion succeeds instead of failing.
      const isOpus = outputFormat === 'ogg' && oggCodec === 'opus';
      if (
        isOpus &&
        (channelCount === 3 || channelCount === 4 || channelCount > 8)
      ) {
        ffmpegArgs.push('-mapping_family', '255');
      }
    }
  }

  // Add output file name
  ffmpegArgs.push(outputFile);

  // Create output directory if it doesn't exist
  const outputFolder = dirname(outputFile);
  if (outputFolder) {
    try {
      if (!existsSync(outputFolder)) {
        mkdirSync(outputFolder, { recursive: true });
      }
    } catch (error) {
      postError(
        `Failed to create output directory: ${outputFolder}. ${getErrorMessage(error)}`,
        { inputFile, outputFile }
      );
      return;
    }
  }

  const writeSmpl = wavSmplLoop
    ? () => {
        if (
          !writeWavSmplLoop(
            outputFile,
            wavSmplLoop!.loopStart,
            wavSmplLoop!.loopLength
          )
        ) {
          logger.warn(`Could not write WAV loop points to ${outputFile}`);
        }
      }
    : undefined;

  await runFFMPEG(
    resolvedFfmpegPath,
    ffmpegArgs,
    outputFile,
    inputFile,
    writeSmpl
  );
};

const runConversion = async (): Promise<void> => {
  // Detailed validation of worker data
  if (!workerData) {
    return failWorker('Worker data is completely missing');
  }

  if (!workerData.file) {
    return failWorker('Worker data missing file object');
  }

  const { inputFile, outputFile, outputFormat } = workerData.file;

  // Validate input file
  if (!inputFile) {
    return failWorker('Missing input file path');
  }

  if (!existsSync(inputFile)) {
    return failWorker(`Input file does not exist: ${inputFile}`);
  }

  // Validate output file
  if (!outputFile) {
    return failWorker('Missing output file path');
  }

  // Validate output format
  if (!outputFormat) {
    return failWorker('Missing output format');
  }

  // Ensure codec is set for OGG
  if (
    outputFormat === 'ogg' &&
    (!workerData.settings || !workerData.settings.oggCodec)
  ) {
    if (!workerData.settings) workerData.settings = {};
    workerData.settings.oggCodec = 'vorbis';
  }

  await converterWorker(workerData);
};

const runFFMPEG = (
  ffmpegPath: string,
  ffmpegArgs: string[],
  outputFile: string,
  inputFile: string,
  afterSuccess?: () => void
): Promise<void> => {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    try {
      // Execute command
      // shell: false + no windowsVerbatimArguments = Node properly quotes args with spaces
      const ffmpegCommand = spawn(ffmpegPath, ffmpegArgs, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      // Let the manager kill ffmpeg if the batch is aborted; terminating this
      // thread does not stop the child process.
      if (ffmpegCommand.pid) {
        parentPort?.postMessage({ type: 'pid', data: ffmpegCommand.pid });
      }

      // ffmpeg -y truncates the output first, so a failed run leaves a
      // partial file behind. Remove it so it isn't mistaken for a result —
      // but only if this run wrote it (a read-only existing file that ffmpeg
      // could not open must be left alone).
      const removePartialOutput = () =>
        removeIfWrittenSince(outputFile, startedAt);

      // Collect error output for better diagnostics
      let errorOutput = '';

      // Capture stderr output and forward to parent for fatal-error detection
      ffmpegCommand.stderr.on('data', (data: Buffer) => {
        const errorText = data.toString();
        errorOutput += errorText;
        if (errorText) {
          parentPort?.postMessage({ type: 'stderr', data: errorText });
        }
      });

      // Handle successful completion
      ffmpegCommand.on('exit', (code: number | null) => {
        if (code === 0) {
          afterSuccess?.();
          parentPort?.postMessage({ type: 'code', data: code });
          resolve(undefined);
        } else {
          const fileExt = outputFile.split('.').pop()?.toLowerCase();
          const formatInfo = fileExt
            ? ` [${fileExt.toUpperCase()} format]`
            : '';
          const msg = `ffmpeg exited with code ${code}${formatInfo}. ${
            errorOutput || 'No error output'
          }`;
          removePartialOutput();
          postError(msg, { inputFile, outputFile });
          reject(new Error(msg));
        }
      });

      // Handle errors during execution
      ffmpegCommand.on('error', (error: unknown) => {
        const msg = `ERROR in ffmpegCommand: ${String(
          error instanceof Error ? error.message : error
        )}`;
        removePartialOutput();
        postError(msg, { inputFile, outputFile });
        reject(new Error(msg));
      });
    } catch (error) {
      const msg = `Failed to start ffmpeg process: ${getErrorMessage(error)}`;
      postError(msg, { inputFile, outputFile });
      reject(new Error(msg));
    }
  });
};

// Workers are always started by the manager.
// Only auto-run when we have the expected worker payload; this avoids side effects in tests
// that mock parentPort but don't provide fully-shaped workerData.
if (
  parentPort &&
  workerData &&
  typeof workerData === 'object' &&
  workerData !== null &&
  'file' in workerData
) {
  void runConversion().catch((error: unknown) => {
    // Most failures were already reported via postError. Anything else (an
    // unexpected throw) must still reach the parent with its real reason,
    // not just a bare "exited without reporting success".
    if (!errorPosted) {
      const f = (workerData && workerData.file) || {};
      postError(`Unexpected worker error: ${getErrorMessage(error)}`, {
        inputFile: f.inputFile,
        outputFile: f.outputFile,
      });
    }
  });
}

export { runConversion, converterWorker };
