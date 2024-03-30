// converterWorker.js
const { spawn, execSync } = require("child_process");
const { workerData, parentPort } = require("worker_threads");
const { join } = require("path");

const getMetadata = async (inputFile) => {
  // console.log("start get meta data");
  try {
    const ffprobePath = join(process.cwd(), `\\ffprobe.exe`);
    const output = execSync(
      `"${ffprobePath}" -v quiet -print_format json -show_format -show_streams "${inputFile}"`,
      { encoding: "utf8" }
    );
    const metadata = JSON.parse(output);
    // console.log("return meta");
    return metadata;
  } catch (error) {
    console.error("😅 Error running ffprobe.exe:", error.message);
    return null;
  }
};

const converterWorker = async ({ inputFile, outputFile, outputFormat }) => {
  console.log(inputFile, outputFile, outputFormat);
  const metadata = await getMetadata(inputFile);
  // console.log("start convertworker");
  if (!metadata) {
    return console.error("No meta data found!!!:", inputFile);
  }
  // console.log("metadata", metadata);
  const streamTags = metadata.streams[0].tags || "";
  const formatTags = metadata.format.tags || "";

  function getMetadataField(tags, formatTags, field) {
    const tagVariants = [field.toLowerCase(), field.toUpperCase()];
    for (const tag of tagVariants) {
      if (tags[tag]) return tags[tag];
      if (formatTags[tag]) return formatTags[tag];
    }
    return "";
  }
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
    // Get the metadata value for the current field
    const value = getMetadataField(streamTags, formatTags, field);
    // If the value exists, add it to the metadata data array
    if (value) {
      // Adjust field names as necessary
      const adjustedField = field === "track" ? "trackNumber" : field;
      metadataDataArray.push(`-metadata ${adjustedField}="${value}"`);
    }
  });
  const metaData = metadataDataArray.join(" ");
  console.log("meta data---------", metaData);

  const channels = "-ac " + metadata.streams[0].channels || "-ac 2";
  const bitrate = metadata.streams[0].bit_rate || null;
  const sampleRate = metadata.streams[0].sample_rate || null;
  let sampleString = "";

  let loopStart = parseInt(
    metadata.streams[0]?.tags?.LOOPSTART ||
      metadata.format?.tags?.LOOPSTART ||
      null
  );
  let loopLength = parseInt(
    metadata.streams[0]?.tags?.LOOPLENGTH ||
      metadata.format?.tags?.LOOPLENGTH ||
      null
  );
  //opus doesn't do 441000 hz.
  if (outputFormat === "ogg") {
    // console.log(typeof sampleRate);
    let newSample = null;
    if (typeof sampleRate === "string") {
      // Only the following values are valid sampling rates for opus: 48000, 24000, 16000, 12000, or 8000
      // vorbis is 8k to 192k
      // mp3 = 8; 11.025; 12; 16; 22.05; 24; 32; 44.1; 48;
      // ffmpeg can handle all but opus which it just makes everything 48k which is not needed
      // and a waste of space for some audio files.
      const sampleRateNumber = parseInt(sampleRate); // Convert string to number
      if (!isNaN(sampleRateNumber)) {
        if (sampleRateNumber >= 48000) {
          newSample = 48000;
        } else if (sampleRateNumber >= 32000) {
          newSample = 48000;
        } else if (sampleRateNumber >= 22050) {
          newSample = 24000;
        } else if (sampleRateNumber > 16000) {
          newSample = 24000;
        } else if (sampleRateNumber > 12000) {
          newSample = 16000;
        } else if (sampleRateNumber >= 8000) {
          newSample = 12000;
        } else if (sampleRateNumber < 8000) {
          newSample = 8000;
        }
        // console.log("sampleRate !== 48000", sampleRateNumber);
        const ratio = 48000 / sampleRateNumber;
        // console.log("ratio", ratio);
        // console.log(loopStart);
        loopStart = Math.round(loopStart * ratio);
        // console.log(loopStart);
        // console.log(loopLength);
        loopLength = Math.round(loopLength * ratio);
        // console.log(loopLength);
        sampleString = "-ar " + newSample.toString();
        console.log("new sample rate-------", sampleString);
      } else {
        console.error("Invalid sampleRate:", sampleRate);
      }
    } else {
      console.error("Sample rate is not a string:", sampleRate);
    }
  }
  // console.log("Loop Start:", loopStart);
  // console.log("Loop Length:", loopLength);
  // console.log("bitrate:", bitrate);
  // console.log("channels:", channels);
  // console.log("formatTags", formatTags);
  // console.log("streamTags", streamTags);
  // console.log("title:", title);
  // console.log("sampleRate:", sampleRate);
  let loopData = "";
  let finalBitrate = 92000;
  if (bitrate < finalBitrate) {
    finalBitrate = bitrate;
  }

  // console.log(finalBitrate, "finalBitrate");
  // console.log(outputFormat);
  if (!isNaN(loopStart) && !isNaN(loopLength)) {
    loopData = `-metadata LOOPLENGTH="${loopLength}" -metadata LOOPSTART="${loopStart}" `;
    // console.log("loop data detected:", loopData);
  }
  const ffmpegPath = join(process.cwd(), `\\ffmpeg.exe`);
  // console.log("start promise");
  const formatConfig = {
    // Despite what you read online these are the best codecs and work fine with most game engines.

    // https://trac.ffmpeg.org/wiki/Encode/MP3
    // https://www.reddit.com/r/ffmpeg/comments/ms77y4/libfdk_aac_vs_aac/
    // https://trac.ffmpeg.org/wiki/Encode/AAC
    // -b:a = constant BR -q:a = variable.
    ogg: {
      codec: "libopus",
      additionalOptions: [
        "-b:a",
        "64k",
        // , "-ar 48000"
      ], //vbr by default
    },
    mp3: { codec: "libmp3lame", additionalOptions: ["-q:a", "3"] }, //175 Average	150-195	-q:a 3
    wav: { codec: "pcm_s16le" },
    m4a: { codec: "aac ", additionalOptions: ["-q:a", ".8"] },
    aiff: { codec: "pcm_s16le" },
    flac: { codec: "flac", additionalOptions: ["-compression_level", "9"] },
  };

  // console.log("titleData", titleData);
  const { codec, additionalOptions = [] } = formatConfig[outputFormat];
  return new Promise((resolve, reject) => {
    const ffmpegCommand = spawn(
      `"${ffmpegPath}"`,
      [
        "-loglevel",
        "error", // Sends all errors to stdeer
        "-i", //input file
        `"${inputFile}"`,
        "-map_metadata",
        // "0",
        "-1", // Strip all metadata from input
        "-c:a", // = codec:audio Indicates the codec for the audio stream.
        codec,
        ...additionalOptions, // Specific codec settings
        `${sampleString}`,
        "-vn", // -vn stops ffmpeg from making output a video file and causing errors
        // "-threads", // will tinker with one day
        // "1",
        "-y", //Overwrite output files without asking.
        `${metaData}`, //Basic meta data
        `${loopData}`, //retains loop tags if they are present
        `${channels}`, // retain inputs number of tracks, Mono/Stereo or more
        `"${outputFile}"`,
      ],
      {
        shell: true,
      }
    );
    ffmpegCommand.stderr.on("data", (data) => {
      parentPort.postMessage({ type: "stderr", data: data.toString() });
    });
    ffmpegCommand.on("exit", (code) => {
      parentPort.postMessage({ type: "code", data: code });
      resolve();
    });
    ffmpegCommand.on("error", (error) => {
      console.error("🛑 ERROR IN FFMPEGCOMMAND", error);
      reject(error);
    });
  });
};

const runConversion = async () => {
  try {
    await converterWorker(workerData);
  } catch (error) {
    console.error("🛑 ERROR in converterWorker:", error);
    parentPort.postMessage("error", error);
  }
};

runConversion();
module.exports = {
  runConversion,
  converterWorker,
  getMetadata,
};

// const title = getMetadataField(streamTags, formatTags, "title");
// const artist = getMetadataField(streamTags, formatTags, "artist");
// const album = getMetadataField(streamTags, formatTags, "album");
// const comment = getMetadataField(streamTags, formatTags, "comment");
// const date = getMetadataField(streamTags, formatTags, "date");
// const track = getMetadataField(streamTags, formatTags, "track");
// const genre = getMetadataField(streamTags, formatTags, "genre");
// const album_artist = getMetadataField(streamTags, formatTags, "album_artist");
// const metaData = metadataDataArray.join(" ");
