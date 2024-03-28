// converterWorker.js
const { spawn, execSync } = require("child_process");
const { workerData, parentPort } = require("worker_threads");
const { join } = require("path");

async function getMetadata(inputFile) {
  // console.log("start get meta data");
  try {
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${inputFile}"`,
      { encoding: "utf8" }
    );
    const metadata = JSON.parse(output);
    // console.log("return meta");
    return metadata;
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}

const converterWorker = async ({ inputFile, outputFile, outputFormat }) => {
  const metadata = await getMetadata(inputFile);
  // console.log("start convertworker");
  if (!metadata) {
    console.error("No meta data found!!!:", inputFile);
  }
  // console.log("22222222222");
  // console.log("metadata", metadata);
  let channels = null;
  let bitrate = null;
  let sampleRate = null;
  const streamTags = metadata.streams[0].tags || "";
  const formatTags = metadata.format.tags || "";

  const title =
    streamTags?.title ||
    streamTags?.TITLE ||
    formatTags?.title ||
    formatTags?.TITLE ||
    "";

  if (metadata.streams[0]) {
    channels = metadata.streams[0].channels || 2;
    bitrate = metadata.streams[0].bit_rate || null;
    sampleRate = metadata.streams[0].sample_rate || null;
  }

  let loopStart = parseInt(
    metadata.streams[0]?.tags?.LOOPSTART ||
      metadata.format.tags.LOOPSTART ||
      null
  );
  let loopLength = parseInt(
    metadata.streams[0]?.tags?.LOOPLENGTH ||
      metadata.format.tags.LOOPLENGTH ||
      null
  );
  //opus doesn't do 441000 hz.
  if (outputFormat === "ogg") {
    // console.log(typeof sampleRate);

    if (typeof sampleRate === "string") {
      // Check if sampleRate is a string
      const sampleRateNumber = parseInt(sampleRate); // Convert string to number
      if (!isNaN(sampleRateNumber)) {
        if (sampleRateNumber !== 48000) {
          // console.log("sampleRate !== 48000", sampleRateNumber);
          const ratio = 48000 / sampleRateNumber;
          // console.log("ratio", ratio);
          // console.log(loopStart);
          loopStart = Math.round(loopStart * ratio);
          // console.log(loopStart);
          // console.log(loopLength);
          loopLength = Math.round(loopLength * ratio);
          // console.log(loopLength);
        }
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
    // this doesn't work anyway...
    if (outputFormat === "m4a" || outputFormat === "wav") {
      // console.log("is wav or m4a");
      loopData = `-metadata:s:a:0 LOOPSTART="${loopStart}" -metadata:s:a:0 LOOPLENGTH="${loopLength}"`;
    }
    // console.log("loop data detected:", loopData);
  }

  return new Promise((resolve, reject) => {
    // console.log("start promise");
    const formatConfig = {
      //Despite what you read online these are the best codecs and work fine with most game engines.
      //-b:a = constant BR -q:a = variable.
      ogg: {
        codec: "libopus",
        additionalOptions: ["-b:a", "92k", "-ar 48000"],
      },
      mp3: { codec: "libmp3lame", additionalOptions: ["-q:a", "6"] },
      wav: { codec: "pcm_s16le" },
      m4a: { codec: "aac ", additionalOptions: ["-q:a", ".8"] },
      flac: { codec: "flac", additionalOptions: ["-compression_level", "9"] },
    };
    const titleData = title ? `-metadata title="${title}"` : "";
    // console.log("titleData", titleData);
    const { codec, additionalOptions = [] } = formatConfig[outputFormat];
    const ffmpegPath = join(process.cwd(), `\\ffmpeg.exe`);
    //------------------------------conversion-------------------------------------------------------------------------
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
        "-vn", // -vn stops ffmpeg from making output a video file and causing errors
        // "-threads", // will tinker with one day
        // "1",
        "-y", //Overwrite output files without asking.
        `${titleData}`,
        `${loopData}`, //retains loop tags if they are present
        // `-ac ${channels}`, // retain inputs number of tracks, Mono/Stereo or more
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
      console.error("ERROR IN WORKER FFMPEGCOMMAND", error);
      reject(error);
    });
  });
};
const runConversion = async () => {
  try {
    await converterWorker(workerData);
  } catch (error) {
    //parentPort.postMessage("error", error);
  }
};
runConversion();
module.exports = {
  runConversion,
  converterWorker,
  getMetadata,
};
