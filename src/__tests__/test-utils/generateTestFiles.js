/**
 * Test Utilities - Generate Test Audio Files
 *
 * Functions to generate test audio files with consistent metadata
 * and loop points for use in tests.
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

/**
 * Find ffmpeg executable (cross-platform)
 * @returns {Object} - Paths to ffmpeg and ffprobe
 */
function findFfmpegExecutables() {
  let ffmpegPath = "ffmpeg";
  let ffprobePath = "ffprobe";

  // Look in project root
  if (fs.existsSync(path.join(process.cwd(), "ffmpeg.exe"))) {
    ffmpegPath = path.join(process.cwd(), "ffmpeg.exe");
    ffprobePath = path.join(process.cwd(), "ffprobe.exe");
  }
  // Look in bin directory
  else if (fs.existsSync(path.join(process.cwd(), "bin", "ffmpeg.exe"))) {
    ffmpegPath = path.join(process.cwd(), "bin", "ffmpeg.exe");
    ffprobePath = path.join(process.cwd(), "bin", "ffprobe.exe");
  }

  return { ffmpegPath, ffprobePath };
}

/**
 * Create necessary test directories
 * @param {string} testDir - Base test directory
 * @returns {Object} - Directory paths
 */
function createTestDirectories(testDir) {
  const inputDir = path.join(testDir, "input");
  const outputDir = path.join(testDir, "output");

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
  }

  // Clean and recreate output directory
  if (fs.existsSync(outputDir)) {
    try {
      fs.readdirSync(outputDir).forEach((file) => {
        try {
          fs.unlinkSync(path.join(outputDir, file));
        } catch (error) {
          console.warn(
            `Warning: Could not delete file ${file}: ${error.message}`
          );
        }
      });
    } catch (error) {
      console.warn(
        `Warning: Could not clean directory ${outputDir}: ${error.message}`
      );
    }
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return { testDir, inputDir, outputDir };
}

/**
 * Generate test audio files with loop points
 * @param {string} inputDir - Directory to create files in
 * @param {Object} options - Options for generating test files
 * @returns {Object} - Generated file paths
 */
function generateTestAudioFiles(inputDir, options = {}) {
  const {
    sampleRate = 44100,
    loopStart = 22050, // 0.5 sec @ 44.1kHz
    loopLength = 88200, // 2 sec @ 44.1kHz
    duration = 5,
    frequency = 440,
    title = "Test Audio",
    artist = "Test Artist",
    formats = ["wav", "mp3", "ogg", "flac", "m4a"],
  } = options;

  const { ffmpegPath } = findFfmpegExecutables();
  const generatedFiles = {};

  // Generate base WAV file with loop points
  const baseWavFile = path.join(inputDir, `loop_${sampleRate}.wav`);
  const baseCmd =
    `"${ffmpegPath}" -y -f lavfi -i "sine=frequency=${frequency}:sample_rate=${sampleRate}:duration=${duration}" ` +
    `-metadata TITLE="${title}" ` +
    `-metadata ARTIST="${artist}" ` +
    `-metadata LOOPSTART="${loopStart}" ` +
    `-metadata LOOPLENGTH="${loopLength}" ` +
    `-metadata loopstart="${loopStart}" ` +
    `-metadata looplength="${loopLength}" ` +
    `-metadata COMMENT="LOOPSTART=${loopStart},LOOPLENGTH=${loopLength}" ` +
    `"${baseWavFile}"`;

  try {
    execSync(baseCmd);
    console.log(`Created base WAV file: ${baseWavFile}`);
    generatedFiles.wav = baseWavFile;

    // Generate other formats if requested
    if (formats.includes("ogg")) {
      const oggFile = path.join(inputDir, `loop_${sampleRate}.ogg`);
      const oggCmd =
        `"${ffmpegPath}" -y -i "${baseWavFile}" ` +
        `-c:a libvorbis -q:a 6 ` +
        `-metadata TITLE="${title} OGG" ` +
        `-metadata ARTIST="${artist}" ` +
        `-metadata COMMENT="LOOPSTART=${loopStart};LOOPLENGTH=${loopLength}" ` +
        `-metadata DESCRIPTION="LOOPSTART=${loopStart};LOOPLENGTH=${loopLength}" ` +
        `-metadata LOOPSTART="${loopStart}" ` +
        `-metadata LOOPLENGTH="${loopLength}" ` +
        `"${oggFile}"`;

      execSync(oggCmd);
      console.log(`Created OGG file: ${oggFile}`);
      generatedFiles.ogg = oggFile;
    }

    // Generate other formats
    const remainingFormats = formats.filter((f) => f !== "wav" && f !== "ogg");
    remainingFormats.forEach((format) => {
      const outputFile = path.join(inputDir, `loop_${sampleRate}.${format}`);
      const cmd =
        `"${ffmpegPath}" -y -i "${baseWavFile}" ` +
        `-metadata LOOPSTART="${loopStart}" ` +
        `-metadata LOOPLENGTH="${loopLength}" ` +
        `-metadata loopstart="${loopStart}" ` +
        `-metadata looplength="${loopLength}" ` +
        `-metadata COMMENT="LOOPSTART=${loopStart},LOOPLENGTH=${loopLength}" ` +
        `"${outputFile}"`;

      try {
        execSync(cmd);
        console.log(`Created ${format.toUpperCase()} file: ${outputFile}`);
        generatedFiles[format] = outputFile;
      } catch (error) {
        console.error(`Error creating ${format} file:`, error.message);
      }
    });
  } catch (error) {
    console.error("Error generating test files:", error.message);
  }

  return generatedFiles;
}

module.exports = {
  findFfmpegExecutables,
  createTestDirectories,
  generateTestAudioFiles,
};
