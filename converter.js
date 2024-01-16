// converter.js

const { join } = require("path");
const { spawn } = require("child_process");
const { workerData, parentPort } = require("worker_threads");

const convertFile = async ({ inputFile, outputFile, outputFormat }) => {
  return new Promise((resolve, reject) => {
    const formatConfig = {
      ogg: { codec: "libopus", additionalOptions: ["-b:a", "192k"] },
      mp3: { codec: "libmp3lame", additionalOptions: ["-q:a", "3"] },
      wav: { codec: "pcm_s16le" },
      m4a: { codec: "aac", additionalOptions: ["-q:a", `1.0`] },
      flac: { codec: "flac", additionalOptions: ["-compression_level", "8"] },
    };
    const { codec, additionalOptions = [] } = formatConfig[outputFormat];
    const ffmpegCommand = spawn(
      join(__dirname, "ffmpeg.exe"),
      [
        //'-loglevel', 'debug',
        "-i",
        `"${inputFile}"`,
        "-c:a",
        codec,
        ...additionalOptions,
        // "-threads",
        // "1",
        "-y",
        `"${outputFile}"`,
      ],
      { shell: true }
    );

    ffmpegCommand.on("close", (code) => {
      parentPort.postMessage(code);
      resolve(code);
    });

    ffmpegCommand.on("error", (error) => {
      parentPort.postMessage(error);
      reject(error);
    });
  });
};
convertFile(workerData);
