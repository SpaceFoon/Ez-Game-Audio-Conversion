// converterWorker.js
// Worker runs ffprobe.exe to get meta data then ffmpeg.exe to convert on one file.
const { spawn, execSync } = require("child_process");
const { workerData, parentPort } = require("worker_threads");
const { join } = require("path");
const { existsSync } = require("fs");

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
    // aiff files not supported by ffprobe
    // if ((inputFile.outputFormat = ".aiff")) return null;
    console.error("😅 Error running ffprobe.exe:", error.message);
    return null;
  }
};

const converterWorker = async ({
  file: { inputFile, outputFile, outputFormat },
  settings: { oggCodec },
}) => {
  //ffprobe gets metadata from input
  const metadata = (await getMetadata(inputFile)) || {};
  let streamTags;
  let formatTags;
  if (metadata.streams) {
    streamTags = metadata.streams[0].tags || "";
  }
  if (metadata.format) {
    formatTags = metadata.format.tags || "";
  }
  // streamTags = metadata?.streams?[0]?.tags || "";
  // formatTags = metadata?.format?.tags || "";

  function getMetadataField(streamTags, formatTags, field) {
    const tagVariants = [field.toLowerCase(), field.toUpperCase()];
    for (const tag of tagVariants) {
      // Tags will only be on one of these objects
      if (streamTags) {
        if (streamTags[tag]) return streamTags[tag] || {};
        if (formatTags[tag]) return formatTags[tag] || {};
      }
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
    if (!field) return "";
    const value = getMetadataField(streamTags, formatTags, field);
    // because you can break the entire ffmpegCommand with meta data
    let cleanValue = value
      .replaceAll(/\n/g, "") //I CANT GET THIS TO WORK \n breaks the entire command string
      // Tested ina terminal and it works fine with `n but that doesn't work here no idea why
      //I was using replace and not replaceAll
      .replaceAll(/\r/g, "")
      .replaceAll(/\\/g, "\\\\") //for the guy who uses "\\\"" as a title...
      .replaceAll(/"/g, '\\"');

    if (cleanValue) {
      // Normalize name of track to trackNumber
      const adjustedField = field === "track" ? "trackNumber" : field;
      metadataDataArray.push(`-metadata ${adjustedField}="${cleanValue}"`);
    }
  });
  const metaData = metadataDataArray.join(" ");
  console.log("metadataarray: ", metaData);
  const channels =
    metadata && metadata.streams && metadata.streams[0]
      ? `-ac ${metadata.streams[0].channels}`
      : "-ac 2";
  const bitrate =
    metadata && metadata.streams && metadata.streams[0]
      ? metadata.streams[0].bit_rate
      : null;
  const sampleRate =
    metadata && metadata.streams && metadata.streams[0]
      ? metadata.streams[0].sample_rate
      : null;
  let sampleString = "";

  console.log("Original sample rate:", sampleRate, "Type:", typeof sampleRate);

  let loopStart = parseInt(
    // loop data can be in stream or format tags
    (metadata.streams && metadata.streams[0]?.tags?.LOOPSTART) ||
      (metadata.format && metadata.format?.tags?.LOOPSTART) ||
      null
  );

  let loopLength = parseInt(
    (metadata.streams && metadata.streams[0]?.tags?.LOOPLENGTH) ||
      (metadata.format && metadata.format?.tags?.LOOPLENGTH) ||
      null
  );

  console.log("Original loop points:", { loopStart, loopLength });

  // opus doesn't do 441000 hz.
  if (outputFormat === "ogg" && oggCodec === "opus") {
    if (typeof sampleRate === "string") {
      // Only the following values are valid sampling rates for opus: 48000, 24000, 16000, 12000, or 8000
      // vorbis is 8k to 192k
      // mp3 = 8; 11.025; 12; 16; 22.05; 24; 32; 44.1; 48;
      // ffmpeg can handle all but opus which it just makes everything 48k which is not needed
      // and a waste of space for some audio files.
      const sampleRateNumber = parseInt(sampleRate); // Convert string to number
      let newSample = null;
      // if (!isNaN(sampleRateNumber)) {
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
      const ratio = newSample / sampleRateNumber;
      // console.log("loopStart1", loopStart);
      loopStart = Math.round(loopStart * ratio);
      // console.log("loopStart2", loopStart);
      // console.log("loopLength1", loopLength);
      loopLength = Math.round(loopLength * ratio);
      // console.log("loopLength2", loopLength);
      sampleString = newSample ? "-ar " + newSample.toString() : "";
    } else {
      console.error(
        "Sample rate is not a string, setting to 48k. Old sample:",
        sampleRate
      );
      newSample = 48000;
    }
  }
  let loopData = "";
  if (!isNaN(loopStart) && !isNaN(loopLength)) {
    loopData = ` -metadata LOOPLENGTH="${loopLength}" -metadata LOOPSTART="${loopStart}" `;
    console.log("loopData1", loopData);
  }
  console.log("loopData2", loopData);

  let ffmpegPath = join(process.cwd(), "\\ffmpeg.exe"); // dev path

  if (!existsSync(ffmpegPath)) {
    ffmpegPath = join(process.cwd(), "bin", "\\ffmpeg.exe"); // prod path
  }

  // Despite what you read online these are the best codecs. WAV and AIFF were chosen for compatibility.
  // https://trac.ffmpeg.org/wiki/TheoraVorbisEncodingGuide
  // https://trac.ffmpeg.org/wiki/Encode/MP3
  // https://trac.ffmpeg.org/wiki/Encode/AAC page is wrong about aac being experimental.
  // -b:a = constant BR -q:a = variable.

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
    wav: { codec: "pcm_s16le" },
    m4a: {
      codec: "aac ",
      additionalOptions: ["-q:a", "1.4", "-movflags use_metadata_tags"],
    },
    aiff: { codec: "pcm_s16le" },
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
  let m4a = "";
  if (outputFormat === ".m4a" || outputFormat === "m4a") {
    m4a = "-movflags -use_metadata_tags";
  }
  // console.log("metadata", metaData);
  return new Promise((resolve, reject) => {
    const ffmpegCommand = spawn(
      `"${ffmpegPath}"`,
      [
        "-loglevel",
        "error", // Sends all errors to stdeer
        "-i", //input file
        `"${inputFile}"`,
        "-map_metadata",
        // "0",  //this is default grab it all. Doesn't work with custom data.
        "-1", // Strip all metadata from input so we can put in our own.
        // `"${m4a}`,
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
      console.error("🛑 ERROR IN ffmpegCommand", error);
      reject(error);
    });
  });
};

const runConversion = async () => {
  try {
    await converterWorker(workerData);
  } catch (error) {
    console.error("🛑 ERROR in converterWorker:", error);
    parentPort.postMessage({ type: "error", data: error.message });
  }
};

runConversion();
module.exports = {
  runConversion,
  converterWorker,
  getMetadata,
};
