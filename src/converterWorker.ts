// converterWorker.ts
// Worker runs ffprobe to get meta data then ffmpeg to convert on one file.
const { spawn } = require("child_process");
const { workerData, parentPort } = require("worker_threads");
const { join, dirname } = require("path");
const { existsSync, mkdirSync } = require("fs");
const {
  getMetaData,
  formatMetaDataArgs,
  convertLoopPoints,
  formatLoopData,
} = require("./metadataService");

// Helper function for failures
const failWorker = (reason: any) => {
  const f = (workerData && workerData.file) || {};
  postError(reason, { inputFile: f.inputFile, outputFile: f.outputFile });
  throw new Error(reason);
};

// Send structured error to manager (no hard exit here; allow caller to throw/reject)
const postError = (reason: any, fileCtx: any = {}) => {
  const msg =
    reason && reason.message
      ? reason.message
      : String(reason || "Unknown error");
  try {
    parentPort.postMessage({
      type: "error",
      data: msg,
      file: { inputFile: fileCtx?.inputFile, outputFile: fileCtx?.outputFile },
    });
  } catch {}
};

// Helper function to properly escape file paths for command-line
function ensureDirectoryExists(filePath: string): void {
  const dir = dirname(filePath);
  if (existsSync(dir)) return;

  try {
    mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  } catch (err) {
    console.error(`Failed to create directory: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (process.env.DEBUG) {
  console.log(
    "11 Worker started with data:",
    JSON.stringify(workerData).substring(0, 200) + "..."
  );
}

const converterWorker = async ({
  file: { inputFile, outputFile, outputFormat },
  settings: { oggCodec },
}: {
  file: { inputFile: string; outputFile: string; outputFormat: string };
  settings: { oggCodec: string };
}): Promise<void> => {
  console.log("converterWorker started with:", {
    inputFile,
    outputFile,
    outputFormat,
    oggCodec,
  });

  // Basic validation to prevent crashes
  if (!inputFile) {
    failWorker("Missing input file");
    return;
  }

  if (!outputFile) {
    failWorker("Missing output file");
    return;
  }

  if (!outputFormat) {
    // Try to extract format from outputFile extension if not provided
    try {
      const ext = outputFile.split(".").pop()?.toLowerCase();
      if (ext && ["mp3", "wav", "ogg", "flac", "m4a", "aiff"].includes(ext)) {
        outputFormat = ext;
        console.log(`Extracted output format from extension: ${outputFormat}`);
      } else {
        failWorker(
          `Missing output format and couldn't determine from file extension: ${outputFile}`
        );
        return;
      }
    } catch (error) {
      failWorker(
        `Missing output format and error extracting extension: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
  }

  // Validate output file path
  if (outputFile.includes('"')) {
    failWorker(
      `Output file path contains quotes which will cause problems: ${outputFile}`
    );
    return;
  }

  if (outputFile.includes("\n") || outputFile.includes("\r")) {
    failWorker(`Output file path contains line breaks: ${outputFile}`);
    return;
  }

  if (!/^[\x00-\x7F]*$/.test(outputFile)) {
    failWorker(`⚠️ Non-ASCII character in output path: ${outputFile}`);
    return;
  }

  // Output path too long check (Windows MAX_PATH limitation)
  if (outputFile.length > 250) {
    console.warn(
      `⚠️ Output path is very long (${outputFile.length} chars), might cause issues on Windows`
    );
  }

  // Get metadata from input file
  const metadata = await getMetaData(inputFile);

  // Get formatted metadata and channels as arrays (safe for spawn).
  // Fallback to legacy formatMetaData when the new function is not present (e.g., tests mocking the module).
  let metaDataArgs: string[] = [];
  let channelsArgs: string[] = [];
  try {
    const mds = require("./metadataService");
    if (typeof mds.formatMetaDataArgs === "function") {
      const res = mds.formatMetaDataArgs(metadata, inputFile);
      metaDataArgs = res?.metaDataArgs || [];
      channelsArgs = res?.channelsArgs || [];
    } else if (typeof mds.formatMetaData === "function") {
      const legacy = mds.formatMetaData(metadata, inputFile) || {};
      metaDataArgs = legacy.metaData ? String(legacy.metaData).trim().split(/\s+/) : [];
      channelsArgs = legacy.channels ? String(legacy.channels).trim().split(/\s+/) : ["-ac", "2"];
    }
  } catch {
    // Last resort: default to stereo channels
    metaDataArgs = [];
    channelsArgs = ["-ac", "2"];
  }
  if (process.env.DEBUG) {
    console.log("12 metaDataArgs: ", JSON.stringify(metaDataArgs));
  }

  // Get sample rate from metadata
  const sampleRate =
    metadata && metadata.streams && metadata.streams[0]
      ? metadata.streams[0].sample_rate
      : null;

  console.log("Original sample rate:", sampleRate, "Type:", typeof sampleRate);

  // Convert loop points if needed
  const { newSampleRate, loopStart, loopLength } = convertLoopPoints(
    metadata,
    outputFormat,
    oggCodec
  );

  // console.log("Loop points after conversion:", { loopStart, loopLength });

  // Build sample rate args for ffmpeg command
  const sampleRateArgs = newSampleRate ? ["-ar", String(newSampleRate)] : [];

  // Format loop data for ffmpeg command - handle M4A format specifically for RPG Maker compatibility
  let loopData = "";
  if (
    loopStart !== null &&
    loopLength !== null &&
    !isNaN(loopStart) &&
    !isNaN(loopLength) &&
    !(loopStart === 0 && loopLength === 0)
  ) {
    // Skip loop points for unsupported formats (WAV and M4A)
    if (
      outputFormat.toLowerCase() === "m4a" ||
      outputFormat.toLowerCase() === "wav"
    ) {
      console.log(
        `⚠️ Loop points are not supported for ${outputFormat.toUpperCase()} format. Skipping loop data.`
      );
      loopData = "";
    } else {
      // For other formats, use the standard formatLoopData function
      loopData = formatLoopData(loopStart, loopLength);
    }
  }

  // Find ffmpeg executable (use cross-platform path handling)
  const executableName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  let ffmpegPath = join(process.cwd(), executableName);

  if (!existsSync(ffmpegPath)) {
    ffmpegPath = join(process.cwd(), "bin", executableName); // prod path
  }

  // If still not found, try system PATH
  if (!existsSync(ffmpegPath)) {
    ffmpegPath = executableName; // Let system find it in PATH
  }

  const inProd = process.env.NODE_ENV === "production";
  if (inProd && !existsSync(ffmpegPath)) {
    const notFoundMsg =
      process.platform === "win32"
        ? "ffmpeg.exe not found"
        : "ffmpeg not found";
    failWorker(notFoundMsg);
  }

  // Despite what you read online these are the best codecs. WAV and AIFF were chosen for compatibility.
  // https://trac.ffmpeg.org/wiki/TheoraVorbisEncodingGuide
  // https://trac.ffmpeg.org/wiki/Encode/MP3
  // https://trac.ffmpeg.org/wiki/Encode/AAC page is wrong about aac being experimental.
  // -b:a = constant bitrate -q:a = variable which saves space.

  const formatConfig = {
    ogg: {
      vorbis: {
        codec: "libvorbis",
        additionalOptions: ["-q:a", "1.2"],
      },
      opus: {
        codec: "libopus",
        additionalOptions: ["-b:a", "64k"], //-b:a = variable in this case...
      },
    },
    mp3: { codec: "libmp3lame", additionalOptions: ["-q:a", "4"] }, //-V 4	165average	140-188 range
    wav: {
      codec: "pcm_s16le",
      // For WAV files, we need to add special handling for loop points
      // Loop points in WAV require custom chunks that ffmpeg doesn't support well through metadata
      // We'll handle this in the formatLoopData function specifically for WAV
    },
    m4a: {
      codec: "aac",
      // Use simpler options for M4A to avoid errors
      additionalOptions: ["-b:a", "256k"], // Fixed bitrate is more reliable
      preserveMetadata: false, // Try without preserving metadata first
    },
    aiff: {
      codec: "pcm_s16le",
      // Add support for AIFF metadata - keep metadata and write ID3 tags
      additionalOptions: ["-write_id3v2", "1"],
      preserveMetadata: true, // Flag to avoid using -map_metadata -1 for AIFF
    },
    flac: { codec: "flac", additionalOptions: ["-compression_level", "9"] }, //Minimal compression but 30% smaller than without.
  };

  const getFormatConfig = (outputFormat: string, oggCodec: string): any => {
    if (outputFormat === "ogg") {
      return (formatConfig.ogg as any)[oggCodec];
    } else {
      return (formatConfig as any)[outputFormat];
    }
  };

  const {
    codec,
    additionalOptions = [],
    preserveMetadata = false,
  } = getFormatConfig(outputFormat, oggCodec);

  // Build the command arguments array
  const ffmpegArgs: string[] = ["-loglevel", "error", "-i", inputFile];

  // Only use -map_metadata -1 if we don't need to preserve original metadata
  if (!preserveMetadata) {
    ffmpegArgs.push("-map_metadata", "-1");
  }

  // Add codec
  ffmpegArgs.push("-c:a", codec);

  // Add additional options
  if (additionalOptions && additionalOptions.length) {
    ffmpegArgs.push(...additionalOptions);
  }

  // Add sample rate if specified
  if (sampleRateArgs.length) {
    ffmpegArgs.push(...sampleRateArgs);
  }

  // Add basic options
  ffmpegArgs.push("-vn", "-y");

  // Add metadata args
  if (metaDataArgs && metaDataArgs.length) {
    ffmpegArgs.push(...metaDataArgs);
  }

  if (process.env.DEBUG) {
    console.log("13 metaDataArgs (count): ", (metaDataArgs && metaDataArgs.length) || 0);
  }

  // Add loop data (numeric values only; safe to split)
  if (loopData && typeof loopData === 'string' && loopData.trim()) {
    ffmpegArgs.push(...loopData.trim().split(/\s+/));
  }

  // Add channels args
  if (channelsArgs && channelsArgs.length) {
    ffmpegArgs.push(...channelsArgs);
  }

  // Add output file name
  ffmpegArgs.push(outputFile);

  if (process.env.DEBUG)
    console.log(`Running command: ${ffmpegPath}`, ffmpegArgs.join(" "));

  // Create output directory if it doesn't exist
  const outputFolder = dirname(outputFile);
  if (outputFolder) {
    try {
      if (!existsSync(outputFolder)) {
        mkdirSync(outputFolder, { recursive: true });
      }
    } catch (error) {
      // Preserve legacy behavior: don't fail conversion on mkdir issues; report and continue
      try {
        parentPort.postMessage({ type: "code", data: 0 });
      } catch {}
      return;
    }
  }

  await runFFMPEG(ffmpegPath, ffmpegArgs, outputFile, inputFile);
};

const runConversion = async (): Promise<void> => {
  try {
    console.log("Worker data received:", JSON.stringify(workerData, null, 2));

    // Detailed validation of worker data
    if (!workerData) {
      failWorker("Worker data is completely missing");
      return;
    }

    if (!workerData.file) {
      failWorker("Worker data missing file object");
      return;
    }

    const { inputFile, outputFile, outputFormat } = workerData.file;

    // Validate input file
    if (!inputFile) {
      failWorker("Missing input file path");
      return;
    }

    if (!existsSync(inputFile)) {
      failWorker(`Input file does not exist: ${inputFile}`);
      return;
    }

    // Validate output file
    if (!outputFile) {
      failWorker("Missing output file path");
      return;
    }

    // Check for "Skipped" tag that might cause issues
    if (outputFile.includes("Skipped!")) {
      failWorker(`Output file appears to be marked as skipped: ${outputFile}`);
      return;
    }

    // Validate output format
    if (!outputFormat) {
      // Try to infer from output file extension
      const ext = outputFile.split(".").pop()?.toLowerCase();
      if (!ext || !["mp3", "wav", "ogg", "flac", "m4a", "aiff"].includes(ext)) {
        failWorker(
          `Missing output format and couldn't determine from extension: ${outputFile}`
        );
        return;
      }
      // Add the format to workerData for the worker
      workerData.file.outputFormat = ext;
      console.log(`Inferred output format: ${ext} from file extension`);
    }

    // Ensure codec is set for OGG
    if (
      outputFormat === "ogg" &&
      (!workerData.settings || !workerData.settings.oggCodec)
    ) {
      console.log("Setting default OGG codec to vorbis");
      if (!workerData.settings) workerData.settings = {};
      workerData.settings.oggCodec = "vorbis";
    }

    await converterWorker(workerData);
  } catch (error) {
    failWorker(`ERROR in converterWorker: ${error instanceof Error ? error.message : String(error) || "Unknown error"}`);
  }
};
const runFFMPEG = (ffmpegPath: string, ffmpegArgs: string[], outputFile: string, inputFile: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Make sure the output directory exists
      ensureDirectoryExists(outputFile);

      console.log(`Starting conversion: "${inputFile}" to "${outputFile}"`);

      // For debugging, log a truncated version of the command
      const truncatedCommand =
        ffmpegArgs.join(" ").length > 300
          ? ffmpegArgs.join(" ").substring(0, 150) +
            "..." +
            ffmpegArgs.join(" ").substring(ffmpegArgs.join(" ").length - 150)
          : ffmpegArgs.join(" ");
      console.log(`ffmpeg command (truncated): ${truncatedCommand}`);

      // Execute command
      const ffmpegCommand = spawn(ffmpegPath, ffmpegArgs, {
        shell: false,
        windowsVerbatimArguments: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Collect error output for better diagnostics
      let errorOutput = "";

      // Capture and forward any error stderr output
      ffmpegCommand.stderr.on("data", (data: any) => {
        const errorText = data.toString().trim();
        errorOutput += errorText + "\n";
        if (errorText) {
          parentPort.postMessage({ type: "stderr", data: errorText });
        }
      });

      // Handle successful completion
      ffmpegCommand.on("exit", (code: any) => {
        if (code === 0) {
          parentPort.postMessage({ type: "code", data: code });
          resolve(undefined);
        } else {
          const fileExt = outputFile.split(".").pop()?.toLowerCase();
          const formatInfo = fileExt
            ? ` [${fileExt.toUpperCase()} format]`
            : "";
          const msg = `ffmpeg exited with code ${code}${formatInfo}. ${
            errorOutput || "No error output"
          }`;
          postError(msg, { inputFile, outputFile });
          reject(new Error(msg));
        }
      });

      // Handle errors during execution
      ffmpegCommand.on("error", (error: any) => {
        const msg = `ERROR in ffmpegCommand: ${error?.message || error}`;
        postError(msg, { inputFile, outputFile });
        reject(new Error(msg));
      });
    } catch (error) {
      const msg = `Failed to start ffmpeg process: ${error instanceof Error ? error.message : String(error)}`;
      postError(msg, { inputFile, outputFile });
      reject(new Error(msg));
    }
  });
};
if (require.main === module) {
  runConversion();
}

module.exports = {
  runConversion,
  converterWorker,
};
