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
} from './metadataService.js';
import { platformSlug, getErrorMessage, findBinary } from './utils.js';
import logger from './logger.js';
import type { LoopDataMode } from './types/settings.js';

type WorkerFileContext = {
  inputFile?: string;
  outputFile?: string;
};

type WorkerErrorMessage = {
  type: 'error';
  data: string;
  file?: WorkerFileContext;
};

// Helper function for failures
const failWorker = (reason: unknown): never => {
  const f = (workerData && workerData.file) || {};
  postError(reason, { inputFile: f.inputFile, outputFile: f.outputFile });
  const msg =
    reason instanceof Error
      ? reason.message
      : String(reason || 'Unknown error');
  throw new Error(msg);
};

// Send structured error to manager (no hard exit here; allow caller to throw/reject)
const postError = (reason: unknown, fileCtx: WorkerFileContext = {}) => {
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
    failWorker('Missing input file');
  }

  if (!outputFile) {
    failWorker('Missing output file');
  }

  if (!outputFormat) {
    failWorker('Missing output format');
  }

  // Validate output file path
  if (outputFile.includes('"')) {
    failWorker(
      `Output file path contains quotes which will cause problems: ${outputFile}`
    );
  }

  if (outputFile.includes('\n') || outputFile.includes('\r')) {
    failWorker(`Output file path contains line breaks: ${outputFile}`);
  }

  // Block Windows-invalid characters and control characters, but allow Unicode
  // Windows NTFS doesn't allow: < > : " | ? *
  // Quotes are already checked above, so we check the rest here
  // Allow : only as drive letter (e.g., C:\) - strip it before checking
  const pathToCheck = /^[A-Za-z]:/.test(outputFile)
    ? outputFile.slice(2)
    : outputFile;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F<>:|?*]/.test(pathToCheck)) {
    failWorker(
      `Output file path contains invalid characters (control chars or <>:|?*): ${outputFile}`
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
  if (resolve(inputFile).toLowerCase() === resolve(outputFile).toLowerCase()) {
    failWorker(
      `CRITICAL: output path resolves to input file — refusing to overwrite: ${inputFile}`
    );
  }

  // Get metadata from input file
  const metadata = await getMetaData(inputFile);

  // Get formatted metadata and channels as arrays (safe for spawn)
  const { metaDataArgs, channelsArgs } = formatMetaDataArgs(
    metadata,
    inputFile
  );

  // Convert loop points if needed
  const { newSampleRate, loopStart, loopLength } = convertLoopPoints(
    metadata,
    outputFormat,
    oggCodec
  );

  // Build sample rate args for ffmpeg command
  const sampleRateArgs = newSampleRate ? ['-ar', String(newSampleRate)] : [];

  // Format loop data for ffmpeg command
  let loopDataArgs: string[] = [];
  if (loopDataMode === 'skip') {
    // User explicitly disabled loop point handling
    loopDataArgs = [];
  } else if (
    loopStart !== null &&
    loopLength !== null &&
    !isNaN(loopStart) &&
    !isNaN(loopLength) &&
    !(loopStart === 0 && loopLength === 0)
  ) {
    // Skip loop points for unsupported formats (WAV and M4A)
    const fmt = outputFormat.toLowerCase();
    if (fmt === 'm4a' || fmt === 'wav') {
      logger.log(
        `Loop points are not supported for ${fmt.toUpperCase()} format`
      );
      loopDataArgs = [];
    } else {
      loopDataArgs = formatLoopData(loopStart, loopLength);
    }
  }

  // Find bundled ffmpeg executable
  const executableName = platformSlug === 'windows' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffmpegPath = findBinary(executableName, [`ffmpeg-bin/${platformSlug}`]);

  if (ffmpegPath === null) {
    failWorker(
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
      // Add support for AIFF metadata - keep metadata and write ID3 tags
      additionalOptions: ['-write_id3v2', '1'],
      preserveMetadata: true, // Flag to avoid using -map_metadata -1 for AIFF
    },
    flac: { codec: 'flac', additionalOptions: ['-compression_level', '9'] }, //Minimal compression but 30% smaller than without.
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
      const oggKey = oggCodec === 'opus' ? 'opus' : 'vorbis';
      const cfg = (formatConfig.ogg as Record<string, FormatConfig>)[oggKey];
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
  const ffmpegArgs: string[] = ['-loglevel', 'error', '-i', inputFile];

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

  // Add basic options
  ffmpegArgs.push('-vn', '-y');

  // Add metadata args only when metadata is being rebuilt.
  // For preserveMetadata formats (AIFF), ffmpeg keeps source metadata;
  // re-applying all tags can create duplicate/conflicting entries.
  if (!preserveMetadata && metaDataArgs && metaDataArgs.length) {
    ffmpegArgs.push(...metaDataArgs);
  }

  // Add loop metadata args
  if (loopDataArgs.length) {
    ffmpegArgs.push(...loopDataArgs);
  }

  // Add channels args
  if (channelsArgs && channelsArgs.length) {
    ffmpegArgs.push(...channelsArgs);
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

  await runFFMPEG(resolvedFfmpegPath, ffmpegArgs, outputFile, inputFile);
};

const runConversion = async (): Promise<void> => {
  // Detailed validation of worker data
  if (!workerData) {
    failWorker('Worker data is completely missing');
  }

  if (!workerData.file) {
    failWorker('Worker data missing file object');
  }

  const { inputFile, outputFile, outputFormat } = workerData.file;

  // Validate input file
  if (!inputFile) {
    failWorker('Missing input file path');
  }

  if (!existsSync(inputFile)) {
    failWorker(`Input file does not exist: ${inputFile}`);
  }

  // Validate output file
  if (!outputFile) {
    failWorker('Missing output file path');
  }

  // Validate output format
  if (!outputFormat) {
    failWorker('Missing output format');
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
  inputFile: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Execute command
      // shell: false + no windowsVerbatimArguments = Node properly quotes args with spaces
      const ffmpegCommand = spawn(ffmpegPath, ffmpegArgs, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Collect error output for better diagnostics
      let errorOutput = '';

      // Capture stderr output (don't forward individually - only send accumulated on error)
      ffmpegCommand.stderr.on('data', (data: Buffer) => {
        const errorText = data.toString().trim();
        errorOutput += errorText + '\n';
      });

      // Handle successful completion
      ffmpegCommand.on('exit', (code: number | null) => {
        if (code === 0) {
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
          postError(msg, { inputFile, outputFile });
          reject(new Error(msg));
        }
      });

      // Handle errors during execution
      ffmpegCommand.on('error', (error: unknown) => {
        const msg = `ERROR in ffmpegCommand: ${String(
          error instanceof Error ? error.message : error
        )}`;
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
  runConversion();
}

export { runConversion, converterWorker };
