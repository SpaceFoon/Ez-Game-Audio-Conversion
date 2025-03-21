const { execSync } = require("child_process");
const { join } = require("path");
const { existsSync } = require("fs");
const { addToLog } = require("./utils");

// Get metadata from a file using ffprobe
const getMetadata = async (inputFile) => {
  try {
    let ffprobePath = join(process.cwd(), "\\ffprobe.exe"); // dev path

    if (!existsSync(ffprobePath)) {
      ffprobePath = join(process.cwd(), "bin", "\\ffprobe.exe"); // prod path
    }

    const output = execSync(
      `"${ffprobePath}" -v quiet -print_format json -show_format -show_streams "${inputFile}"`,
      { encoding: "utf8" }
    );
    const metadata = JSON.parse(output);
    return metadata;
  } catch (error) {
    console.error("😅 Error running ffprobe.exe:", error.message);
    return null;
  }
};

// Extract metadata fields from tags
const getMetadataField = (streamTags, formatTags, field) => {
  if (!streamTags && !formatTags) return "";

  const tagVariants = [field.toLowerCase(), field.toUpperCase()];
  for (const tag of tagVariants) {
    if (streamTags && streamTags[tag]) return streamTags[tag];
    if (formatTags && formatTags[tag]) return formatTags[tag];
  }
  return "";
};

// Format metadata for ffmpeg command
const formatMetadata = (metadata) => {
  if (!metadata || !metadata.streams)
    return { metaData: "", channels: "-ac 2" };

  let streamTags = metadata.streams[0]?.tags || "";
  let formatTags = metadata.format?.tags || "";

  const metadataFields = [
    "title",
    "artist",
    "album",
    "comment",
    "date",
    "track",
    "genre",
    "album_artist",
  ];

  const metadataDataArray = [];

  metadataFields.forEach((field) => {
    if (!field) return;
    const value = getMetadataField(streamTags, formatTags, field);
    // because you can break the entire ffmpegCommand with meta data
    let cleanValue = value
      .replaceAll(/\n/g, "")
      .replaceAll(/\r/g, "")
      .replaceAll(/\\/g, "\\\\")
      .replaceAll(/"/g, '\\"');

    if (cleanValue) {
      // Normalize name of track to trackNumber
      const adjustedField = field === "track" ? "trackNumber" : field;
      metadataDataArray.push(`-metadata ${adjustedField}="${cleanValue}"`);
    }
  });

  const metaData = metadataDataArray.join(" ");
  const channels = metadata.streams[0]
    ? `-ac ${metadata.streams[0].channels}`
    : "-ac 2";

  return { metaData, channels };
};

// Get loop points from metadata
const getLoopPoints = (metadata) => {
  if (!metadata) return { loopStart: NaN, loopLength: NaN };

  const loopStart = parseInt(
    (metadata.streams && metadata.streams[0]?.tags?.LOOPSTART) ||
      (metadata.format && metadata.format?.tags?.LOOPSTART) ||
      null
  );

  const loopLength = parseInt(
    (metadata.streams && metadata.streams[0]?.tags?.LOOPLENGTH) ||
      (metadata.format && metadata.format?.tags?.LOOPLENGTH) ||
      null
  );

  return { loopStart, loopLength };
};

// Convert loop points for different sample rates
const convertLoopPoints = (metadata, outputFormat, oggCodec) => {
  if (!metadata || !metadata.streams) {
    return {
      newSampleRate: null,
      loopStart: NaN,
      loopLength: NaN,
    };
  }

  // Get original values
  const sampleRate = metadata.streams[0].sample_rate;
  const { loopStart, loopLength } = getLoopPoints(metadata);

  console.log("convertLoopPoints - Original values:", {
    sampleRate,
    loopStart,
    loopLength,
  });

  // If not converting to opus or no valid loop points, return original values
  if (
    outputFormat !== "ogg" ||
    oggCodec !== "opus" ||
    isNaN(loopStart) ||
    isNaN(loopLength)
  ) {
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
  } else if (sampleRateNumber >= 22050) {
    newSampleRate = 24000;
  } else if (sampleRateNumber > 16000) {
    newSampleRate = 24000;
  } else if (sampleRateNumber > 12000) {
    newSampleRate = 16000;
  } else if (sampleRateNumber >= 8000) {
    newSampleRate = 12000;
  } else if (sampleRateNumber < 8000) {
    newSampleRate = 8000;
  }

  // Convert loop points based on sample rate change
  const ratio = newSampleRate / sampleRateNumber;
  const convertedLoopStart = Math.round(loopStart * ratio);
  const convertedLoopLength = Math.round(loopLength * ratio);

  console.log("convertLoopPoints - Conversion:", {
    oldSampleRate: sampleRateNumber,
    newSampleRate,
    ratio,
    oldLoopStart: loopStart,
    newLoopStart: convertedLoopStart,
    oldLoopLength: loopLength,
    newLoopLength: convertedLoopLength,
  });

  return {
    newSampleRate,
    loopStart: convertedLoopStart,
    loopLength: convertedLoopLength,
  };
};

// Format loop data for ffmpeg command
const formatLoopData = (loopStart, loopLength) => {
  if (isNaN(loopStart) || isNaN(loopLength)) return "";

  return ` -metadata LOOPSTART="${loopStart}" -metadata LOOPLENGTH="${loopLength}" `;
};

module.exports = {
  getMetadata,
  getMetadataField,
  formatMetadata,
  getLoopPoints,
  convertLoopPoints,
  formatLoopData,
};
