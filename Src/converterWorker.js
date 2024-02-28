// converterWorker.js
const { spawn } = require("child_process");
const { workerData, parentPort } = require("worker_threads");
const { join } = require("path");
const converterWorker = async ({ inputFile, outputFile, outputFormat }) => {
  // console.log("process.env.ComSpec ", process.env.ComSpec);
  // console.log("DIRNAME worker", process.cwd(), __dirname, __filename);
  // console.log("inputFile", inputFile);
  const ffmpegPath = join(process.cwd(), `\\ffmpeg.exe`);
  //console.log("path worker", ffmpegPath);
  return new Promise((resolve, reject) => {
    const formatConfig = {
      //Despite what you read online these are the best codecs and work fine.
      //-b:a = constant BR -q:a = variable.
      ogg: { codec: "libopus", additionalOptions: ["-b:a", "192k"] },
      mp3: { codec: "libmp3lame", additionalOptions: ["-q:a", "3"] },
      wav: { codec: "pcm_s16le" },
      m4a: { codec: "aac ", additionalOptions: ["-q:a", "1.1"] },
      flac: { codec: "flac", additionalOptions: ["-compression_level", "9"] },
    };

    const { codec, additionalOptions = [] } = formatConfig[outputFormat];
    const ffmpegCommand = spawn(
      `"${ffmpegPath}"`,
      [
        "-loglevel",
        "error", // Sends all errors to stdeer
        "-i", //input file
        `"${inputFile}"`,
        "-c:a", // = codec:audio Indicates the codec for the audio stream.
        codec,
        ...additionalOptions, // Specific codec settings
        "-vn", // -vn stops ffmpeg from making output a video file and causing errors
        // "-threads",
        // "1",
        "-y", //Disable prompts
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
};
