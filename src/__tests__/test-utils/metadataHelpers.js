/**
 * Test Utilities - Metadata Helpers
 *
 * Functions for extracting and verifying metadata from audio files.
 */

const { spawnSync } = require("child_process");
const { findFfmpegExecutables } = require("./generateTestFiles");

/**
 * Extract metadata from an audio file
 * @param {string} filePath - Path to the audio file
 * @returns {Object|null} - Parsed metadata or null on error
 */
function extractMetadata(filePath) {
  const { ffprobePath } = findFfmpegExecutables();

  try {
    const result = spawnSync(
      ffprobePath,
      [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { encoding: "utf8" }
    );

    if (result.status !== 0) {
      console.error(`Failed to extract metadata from: ${filePath}`);
      return null;
    }

    return JSON.parse(result.stdout);
  } catch (error) {
    console.error(`Error extracting metadata: ${error.message}`);
    return null;
  }
}

/**
 * Extract loop points from file metadata
 * @param {Object} metadata - Metadata object from extractMetadata()
 * @returns {Object} - Loop points { loopStart, loopLength }
 */
function extractLoopPoints(metadata) {
  const loopPoints = { loopStart: null, loopLength: null };

  if (!metadata) return loopPoints;

  // Check streams[0].tags (especially for OGG files)
  if (metadata.streams && metadata.streams[0] && metadata.streams[0].tags) {
    const tags = metadata.streams[0].tags;

    // Check for direct tag values
    if (tags.LOOPSTART !== undefined)
      loopPoints.loopStart = parseInt(tags.LOOPSTART);
    else if (tags.loopstart !== undefined)
      loopPoints.loopStart = parseInt(tags.loopstart);
    else if (tags.LOOP_START !== undefined)
      loopPoints.loopStart = parseInt(tags.LOOP_START);

    if (tags.LOOPLENGTH !== undefined)
      loopPoints.loopLength = parseInt(tags.LOOPLENGTH);
    else if (tags.looplength !== undefined)
      loopPoints.loopLength = parseInt(tags.looplength);
    else if (tags.LOOP_LENGTH !== undefined)
      loopPoints.loopLength = parseInt(tags.LOOP_LENGTH);

    // Check comment fields
    if (
      (!loopPoints.loopStart || !loopPoints.loopLength) &&
      (tags.COMMENT || tags.comment)
    ) {
      extractFromComment(tags.COMMENT || tags.comment, loopPoints);
    }

    // Check description fields
    if (
      (!loopPoints.loopStart || !loopPoints.loopLength) &&
      (tags.DESCRIPTION || tags.description)
    ) {
      extractFromComment(tags.DESCRIPTION || tags.description, loopPoints);
    }
  }

  // Check format.tags (most formats use this)
  if (
    (!loopPoints.loopStart || !loopPoints.loopLength) &&
    metadata.format &&
    metadata.format.tags
  ) {
    const tags = metadata.format.tags;

    // Check for direct tag values if not already found
    if (!loopPoints.loopStart) {
      if (tags.LOOPSTART !== undefined)
        loopPoints.loopStart = parseInt(tags.LOOPSTART);
      else if (tags.loopstart !== undefined)
        loopPoints.loopStart = parseInt(tags.loopstart);
      else if (tags.LOOP_START !== undefined)
        loopPoints.loopStart = parseInt(tags.LOOP_START);
    }

    if (!loopPoints.loopLength) {
      if (tags.LOOPLENGTH !== undefined)
        loopPoints.loopLength = parseInt(tags.LOOPLENGTH);
      else if (tags.looplength !== undefined)
        loopPoints.loopLength = parseInt(tags.looplength);
      else if (tags.LOOP_LENGTH !== undefined)
        loopPoints.loopLength = parseInt(tags.LOOP_LENGTH);
    }

    // Check comment fields
    if (
      (!loopPoints.loopStart || !loopPoints.loopLength) &&
      (tags.COMMENT || tags.comment)
    ) {
      extractFromComment(tags.COMMENT || tags.comment, loopPoints);
    }

    // Check description fields
    if (
      (!loopPoints.loopStart || !loopPoints.loopLength) &&
      (tags.DESCRIPTION || tags.description)
    ) {
      extractFromComment(tags.DESCRIPTION || tags.description, loopPoints);
    }
  }

  return loopPoints;
}

/**
 * Extract loop points from a comment string
 * @param {string} commentText - Comment text to parse
 * @param {Object} loopPoints - Loop points object to update
 */
function extractFromComment(commentText, loopPoints) {
  if (!commentText) return;

  // Try with comma separator: "LOOPSTART=22050,LOOPLENGTH=44100"
  let loopStartMatch = commentText.match(/LOOPSTART=(\d+),/i);
  let loopLengthMatch = commentText.match(/LOOPLENGTH=(\d+)/i);

  // If not found, try with semicolon separator: "LOOPSTART=22050;LOOPLENGTH=44100"
  if (!loopStartMatch) loopStartMatch = commentText.match(/LOOPSTART=(\d+);/i);
  if (!loopLengthMatch)
    loopLengthMatch = commentText.match(/LOOPLENGTH=(\d+)/i);

  // Also try space separator
  if (!loopStartMatch)
    loopStartMatch = commentText.match(/LOOPSTART=(\d+)( |$)/i);

  if (loopStartMatch && !loopPoints.loopStart) {
    loopPoints.loopStart = parseInt(loopStartMatch[1]);
  }

  if (loopLengthMatch && !loopPoints.loopLength) {
    loopPoints.loopLength = parseInt(loopLengthMatch[1]);
  }
}

/**
 * Adjust loop points for sample rate conversion
 * @param {Number} loopStart - Original loop start point
 * @param {Number} loopLength - Original loop length
 * @param {Number} inputSampleRate - Original sample rate
 * @param {Number} outputSampleRate - Target sample rate
 * @returns {Object} - Adjusted loop points { loopStart, loopLength }
 */
function adjustLoopPoints(
  loopStart,
  loopLength,
  inputSampleRate,
  outputSampleRate
) {
  if (
    loopStart === null ||
    loopLength === null ||
    !inputSampleRate ||
    !outputSampleRate
  ) {
    return { loopStart: NaN, loopLength: NaN };
  }

  const ratio = outputSampleRate / inputSampleRate;
  loopStart = Math.round(loopStart * ratio);
  loopLength = Math.round(loopLength * ratio);

  return {
    loopStart,
    loopLength,
  };
}

/**
 * Get sample rate from metadata
 * @param {Object} metadata - Metadata object
 * @returns {Number|null} - Sample rate or null if not found
 */
function getSampleRate(metadata) {
  if (!metadata || !metadata.streams || !metadata.streams[0]) return null;

  const sampleRateStr = metadata.streams[0].sample_rate;
  if (!sampleRateStr) return null;

  return parseInt(sampleRateStr);
}

/**
 * Verify loop points in a file match expected values
 * @param {string} filePath - Path to audio file
 * @param {Object} expectedPoints - Expected loop points { loopStart, loopLength }
 * @returns {boolean} - True if points match, false otherwise
 */
function verifyLoopPoints(filePath, expectedPoints) {
  const metadata = extractMetadata(filePath);
  if (!metadata) return false;

  const actualPoints = extractLoopPoints(metadata);

  const startMatches = actualPoints.loopStart === expectedPoints.loopStart;
  const lengthMatches = actualPoints.loopLength === expectedPoints.loopLength;

  if (!startMatches || !lengthMatches) {
    console.log("Loop points mismatch:");
    console.log(
      `  Expected: start=${expectedPoints.loopStart}, length=${expectedPoints.loopLength}`
    );
    console.log(
      `  Actual: start=${actualPoints.loopStart}, length=${actualPoints.loopLength}`
    );
    return false;
  }

  return true;
}

module.exports = {
  extractMetadata,
  extractLoopPoints,
  adjustLoopPoints,
  getSampleRate,
  verifyLoopPoints,
};
