// converterWorker.js
const { spawn, execSync } = require("child_process");
const { workerData, parentPort } = require("worker_threads");
const { join } = require("path");

const getMetadata = async (inputFile) => {
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
    if ((inputFile.outputFormat = ".aiff")) return null;
    "😅 Error running ffprobe.exe:", error.message;
    return null;
  }
};

const converterWorker = async ({
  file: { inputFile, outputFile, outputFormat },
  settings: { oggCodec },
}) => {
  const metadata = await getMetadata(inputFile);
  const streamTags = metadata?.streams[0]?.tags || "";
  const formatTags = metadata?.format?.tags || "";

  function getMetadataField(streamTags, formatTags, field) {
    const tagVariants = [field.toLowerCase(), field.toUpperCase()];
    for (const tag of tagVariants) {
      if (streamTags[tag]) return streamTags[tag];
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
    const value = getMetadataField(streamTags, formatTags, field);
    // because you can break the entire ffmpegCommand with meta data
    let cleanValue = value
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\n")
      .replace(/\\/g, "\\\\");
    if (cleanValue) {
      // Adjust field names as necessary
      const adjustedField = field === "track" ? "trackNumber" : field;
      metadataDataArray.push(`-metadata ${adjustedField}="${cleanValue}"`);
    }
  });
  const metaData = metadataDataArray.join(" ");

  const channels = "-ac " + metadata.streams[0]?.channels || "-ac 2";
  const bitrate = metadata.streams[0]?.bit_rate || null;
  const sampleRate = metadata.streams[0]?.sample_rate || null;
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
  // opus doesn't do 441000 hz.
  // console.log("oggCodec", oggCodec);
  if (outputFormat === "ogg" && oggCodec === "opus") {
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
        const ratio = newSample / sampleRateNumber;

        loopStart = Math.round(loopStart * ratio);

        loopLength = Math.round(loopLength * ratio);

        sampleString = "-ar " + newSample.toString();
      } else {
        console.error("Invalid sampleRate:", sampleRate);
      }
    } else {
      console.error("Sample rate is not a string:", sampleRate);
    }
  }
  let loopData = "";
  if (!isNaN(loopStart) && !isNaN(loopLength)) {
    loopData = `-metadata LOOPLENGTH="${loopLength}" -metadata LOOPSTART="${loopStart}" `;
  }
  const ffmpegPath = join(process.cwd(), `\\ffmpeg.exe`);
  // Despite what you read online these are the best codecs.
  //https://trac.ffmpeg.org/wiki/TheoraVorbisEncodingGuide
  // https://trac.ffmpeg.org/wiki/Encode/MP3
  // https://trac.ffmpeg.org/wiki/Encode/AAC page is wrong about aac being experimental
  // -b:a = constant BR -q:a = variable.
  const formatConfig = {
    ogg: {
      vorbis: {
        codec: "libvorbis",
        additionalOptions: ["-q:a", "1.2"],
      },
      opus: {
        codec: "libopus",
        additionalOptions: ["-b:a", "64k"], //vbr by default
      },
    },
    mp3: { codec: "libmp3lame", additionalOptions: ["-q:a", "4"] }, //-V 4	165average	140-188 range
    wav: { codec: "pcm_s16le" },
    m4a: { codec: "aac ", additionalOptions: ["-q:a", "1.4"] },
    aiff: { codec: "pcm_s16le" },
    flac: { codec: "flac", additionalOptions: ["-compression_level", "9"] },
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
