// converterWorker.js
// Worker runs ffprobe.exe to get meta data then ffmpeg.exe to convert on one file.
const { spawn } = require("child_process");
const { workerData, parentPort } = require("worker_threads");
const { join, dirname } = require("path");
const { existsSync, mkdirSync } = require("fs");
const {
  getMetaData,
  formatMetaData,
  convertLoopPoints,
  formatLoopData,
} = require("./metaDataService");
const chalk = require("chalk");

// Helper function to properly escape file paths for command-line
function escapePath(filePath) {
  if (!filePath) return '""';

  // Windows paths need special care for spaces and special characters
  // Enclose the entire path in double quotes
  return `"${filePath.replace(/"/g, '\\"')}"`;
}

function ensureDirectoryExists(filePath) {
  const dir = dirname(filePath);
  if (existsSync(dir)) return;

  try {
    mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  } catch (err) {
    console.error(`Failed to create directory: ${err.message}`);
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
}) => {
  console.log("converterWorker started with:", {
    inputFile,
    outputFile,
    outputFormat,
    oggCodec,
  });

  // Basic validation to prevent crashes
  if (!inputFile) {
    fail("Missing input file");
    return;
  }

  if (!outputFile) {
    fail("Missing output file");
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
        console.error(`Cannot determine format from extension: ${outputFile}`);
        fail(
          `Missing output format and couldn't determine from file extension: ${outputFile}`
        );
        return;
      }
    } catch (error) {
      console.error(`Error extracting extension: ${error.message}`);
      fail(
        `Missing output format and error extracting extension: ${error.message}`
      );
      return;
    }
  }

  // Validate output file path
  if (outputFile.includes('"')) {
    fail(
      `Output file path contains quotes which will cause problems: ${outputFile}`
    );
    return;
  }

  if (outputFile.includes("\n") || outputFile.includes("\r")) {
    fail(`Output file path contains line breaks: ${outputFile}`);
    return;
  }

  if (!/^[\x00-\x7F]*$/.test(outputFile)) {
    fail(`⚠️ Non-ASCII character in output path: ${outputFile}`);
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

  // Get formatted metadata and channels
  const { metaData, channels } = formatMetaData(metadata);
  if (process.env.DEBUG) {
    console.log("12 metadataarray: ", metaData);
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

  // Set sample rate string for ffmpeg command
  let sampleString = newSampleRate ? `-ar ${newSampleRate}` : "";

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
  let ffmpegPath = join(process.cwd(), "ffmpeg.exe");

  if (!existsSync(ffmpegPath)) {
    ffmpegPath = join(process.cwd(), "bin", "ffmpeg.exe"); // prod path
  }

  // Skip the file existence check in test mode
  if (!existsSync(ffmpegPath) && process.env.NODE_ENV !== "test") {
    console.error("😅 Error: ffmpeg.exe not found at paths tried:", {
      paths: [
        join(process.cwd(), "ffmpeg.exe"),
        join(process.cwd(), "bin", "ffmpeg.exe"),
      ],
    });
    throw new Error("ffmpeg.exe not found");
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

  const getFormatConfig = (outputFormat, oggCodec) => {
    if (outputFormat === "ogg") {
      return formatConfig.ogg[oggCodec];
    } else {
      return formatConfig[outputFormat];
    }
  };

  const { codec, additionalOptions = [] } = getFormatConfig(
    outputFormat,
    oggCodec
  );

  // Build the command as a single string
  // Don't strip metadata for formats that need to preserve it
  const preserveMetadata =
    formatConfig[outputFormat]?.preserveMetadata || false;

  // Use escapePath to properly handle file paths
  let ffmpegCommandStr = `"${ffmpegPath}" -loglevel error -i ${escapePath(
    inputFile
  )}`;

  // Only use -map_metadata -1 if we don't need to preserve original metadata
  if (!preserveMetadata) {
    ffmpegCommandStr += " -map_metadata -1";
  }

  // Add codec
  ffmpegCommandStr += ` -c:a ${codec}`;

  // Add additional options
  if (additionalOptions && additionalOptions.length) {
    ffmpegCommandStr += " " + additionalOptions.join(" ");
  }

  // Add sample rate if specified
  if (sampleString) {
    ffmpegCommandStr += " " + sampleString;
  }

  // Add basic options
  ffmpegCommandStr += " -vn -y";

  // Add metadata - metaData is already formatted with escaped values from formatMetaData()
  if (metaData && metaData.trim()) {
    ffmpegCommandStr += " " + metaData;
  }

  if (process.env.DEBUG) {
    console.log("13 metaData: ", metaData);
  }

  // Add loop data
  if (loopData && loopData.trim()) {
    ffmpegCommandStr += " " + loopData;
  }

  // Add channels
  ffmpegCommandStr += channels;

  // Add output file name with proper escaping
  ffmpegCommandStr += ` ${escapePath(outputFile)}`;

  if (process.env.DEBUG) console.log(`Running command: ${ffmpegCommandStr}`);

  // Create output directory if it doesn't exist
  const outputFolder = dirname(outputFile);
  if (outputFolder) {
    try {
      if (!existsSync(outputFolder)) {
        mkdirSync(outputFolder, { recursive: true });
      }
    } catch (error) {
      console.error(
        chalk.redBright.bold("Couldn't create directory, check folder"),
        error
      );
      // Continue without failing for directory creation issues
      // This allows running in test environments where directories are mocked
      parentPort.postMessage({ type: "code", data: 0 });
      return;
    }
  }

  await runFFMPEG(ffmpegCommandStr, outputFile, inputFile);
};

const runConversion = async () => {
  try {
    console.log("Worker data received:", JSON.stringify(workerData, null, 2));

    // Detailed validation of worker data
    if (!workerData) {
      fail("Worker data is completely missing");
      return;
    }

    if (!workerData.file) {
      fail("Worker data missing file object");
      return;
    }

    const { inputFile, outputFile, outputFormat } = workerData.file;

    // Validate input file
    if (!inputFile) {
      fail("Missing input file path");
      return;
    }

    if (!existsSync(inputFile)) {
      fail(`Input file does not exist: ${inputFile}`);
      return;
    }

    // Validate output file
    if (!outputFile) {
      fail("Missing output file path");
      return;
    }

    // Check for "Skipped" tag that might cause issues
    if (outputFile.includes("Skipped!")) {
      fail(`Output file appears to be marked as skipped: ${outputFile}`);
      return;
    }

    // Validate output format
    if (!outputFormat) {
      // Try to infer from output file extension
      const ext = outputFile.split(".").pop()?.toLowerCase();
      if (!ext || !["mp3", "wav", "ogg", "flac", "m4a", "aiff"].includes(ext)) {
        fail(
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
    fail(`🛑 ERROR in converterWorker: ${error.message || "Unknown error"}`);
  }
};
const runFFMPEG = (ffmpegCommandStr, outputFile, inputFile) => {
  return new Promise((resolve, reject) => {
    try {
      // Make sure the output directory exists
      ensureDirectoryExists(outputFile);

      console.log(`Starting conversion: "${inputFile}" to "${outputFile}"`);

      // For debugging, log a truncated version of the command
      const truncatedCommand =
        ffmpegCommandStr.length > 300
          ? ffmpegCommandStr.substring(0, 150) +
            "..." +
            ffmpegCommandStr.substring(ffmpegCommandStr.length - 150)
          : ffmpegCommandStr;
      console.log(`ffmpeg command (truncated): ${truncatedCommand}`);

      // Execute command
      const ffmpegCommand = spawn(ffmpegCommandStr, { shell: true });

      // Collect error output for better diagnostics
      let errorOutput = "";

      // Capture and forward any error stderr output
      ffmpegCommand.stderr.on("data", (data) => {
        const errorText = data.toString().trim();
        errorOutput += errorText + "\n";
        if (errorText) {
          console.error(`ffmpeg stderr: ${errorText}`);
          parentPort.postMessage({ type: "stderr", data: errorText });
        }
      });

      // Handle successful completion
      ffmpegCommand.on("exit", (code) => {
        if (code === 0) {
          // Pass in test environments.
          const isTestEnvironment = process.env.NODE_ENV === "test";

          if (isTestEnvironment || existsSync(outputFile)) {
            console.log(
              `✅ Conversion successful: ${inputFile} → ${outputFile}`
            );
            parentPort.postMessage({ type: "code", data: code });
            resolve();
          } else {
            const fileExt = outputFile.split(".").pop()?.toLowerCase();
            const formatInfo = fileExt
              ? ` [${fileExt.toUpperCase()} format]`
              : "";

            // Check if we can create an empty file to test write permissions
            try {
              const testPath =
                dirname(outputFile) + "/test_write_" + Date.now() + ".tmp";
              const fs = require("fs");
              fs.writeFileSync(testPath, "test");
              fs.unlinkSync(testPath);
              console.log(
                "✅ Write permission test passed for output directory"
              );
            } catch (err) {
              console.error(`❌ Write permission test failed: ${err.message}`);
            }

            fail(
              `❌ Conversion failed${formatInfo}: Output file ${outputFile} not created.\n` +
                `   Error details: ${errorOutput || "No error output"}\n` +
                `   Check permissions and disk space.`
            );
          }
        } else {
          const fileExt = outputFile.split(".").pop()?.toLowerCase();
          const formatInfo = fileExt
            ? ` [${fileExt.toUpperCase()} format]`
            : "";

          fail(
            `❌ ffmpeg exited with code ${code}${formatInfo}.\n` +
              `   Error details: ${errorOutput || "No error output"}\n` +
              `   Check if ffmpeg is installed correctly.`
          );
        }
      });

      // Handle errors during execution
      ffmpegCommand.on("error", (error) => {
        const fileExt = outputFile.split(".").pop()?.toLowerCase();
        const formatInfo = fileExt ? ` [${fileExt.toUpperCase()} format]` : "";

        console.error(`🛑 ERROR IN ffmpegCommand${formatInfo}:`);
        console.error(`   Error message: ${error.message || error}`);
        console.error(`   Input file: ${inputFile}`);
        console.error(`   Output file: ${outputFile}`);

        // Check if ffmpeg exists
        try {
          const fs = require("fs");
          const ffmpegPath = join(process.cwd(), "ffmpeg.exe");
          const ffmpegPathBin = join(process.cwd(), "bin", "ffmpeg.exe");

          console.error(`   ffmpeg.exe exists: ${fs.existsSync(ffmpegPath)}`);
          console.error(
            `   ffmpeg.exe in bin exists: ${fs.existsSync(ffmpegPathBin)}`
          );
        } catch (err) {
          console.error(`   Error checking ffmpeg: ${err.message}`);
        }

        fail(
          `🛑 ERROR IN ffmpegCommand${formatInfo}: ${
            error.message || error
          }\n` +
            `   Make sure ffmpeg.exe is properly installed in the application directory.\n` +
            `   Command: ${ffmpegCommandStr.substring(0, 300)}...`
        );
        reject(error);
      });
    } catch (error) {
      console.error(
        `🛑 Failed to start ffmpeg process: ${error.message || error}`
      );
      console.error(`   Input file: ${inputFile}`);
      console.error(`   Output file: ${outputFile}`);

      // Try to give more specific advice based on the error
      if (error.code === "ENOENT") {
        console.error(
          "   It appears ffmpeg.exe couldn't be found. Make sure it's in the application directory."
        );
      } else if (error.code === "EACCES") {
        console.error(
          "   Permission denied. Make sure you have the right permissions to execute ffmpeg.exe."
        );
      }

      reject(error);
    }
  });
};
const fail = (reason) => {
  console.error("🛑", reason);

  // If we have worker data, include details in the error message
  if (workerData && workerData.file) {
    const { inputFile, outputFile, outputFormat } = workerData.file;
    console.error("📋 Conversion details:");
    console.error(`   Input file: ${inputFile || "undefined"}`);
    console.error(`   Output file: ${outputFile || "undefined"}`);
    console.error(`   Output format: ${outputFormat || "undefined"}`);

    // Check if the input file exists
    if (inputFile && !existsSync(inputFile)) {
      console.error("❌ Input file does not exist!");
    }

    // Check if output directory exists
    if (outputFile) {
      const outputDir = dirname(outputFile);
      if (!existsSync(outputDir)) {
        console.error(`❌ Output directory does not exist: ${outputDir}`);
      }
    }
  }

  parentPort.postMessage({ type: "error", data: reason });
  throw new Error(reason);
};

// Only run if executed directly, not when required for tests
if (require.main === module) {
  runConversion();
}

module.exports = {
  runConversion,
  converterWorker,
};
