const { join } = require("path");
const { spawn } = require("child_process");
const { parentPort, workerData } = require("worker_threads");
const { inputFile, outputFile, outputFormat } = workerData;
const convert = async (inputFile, outputFile, outputFormat) => {
  const formatConfig = {
    ogg: { codec: "libopus", additionalOptions: ["-b:a", "192k"] },
    mp3: { codec: "libmp3lame", additionalOptions: ["-q:a", "3"] },
    wav: { codec: "pcm_s16le" },
    m4a: { codec: "aac", additionalOptions: ["-q:a", `1.0`] },
    flac: { codec: "flac", additionalOptions: ["-compression_level", "8"] },
  };

  const failedFiles = [];

  // if (!formatInfo) {
  //   console.error("Unsupported output format:", outputFormat);
  //   return; // or handle the error in a way that suits your application
  // }

  return new Promise((resolve, reject) => {
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
        // The below probably does nothing with audio. Testing backs this up.
        // There may be more to come? https://ffmpeg.org/pipermail/ffmpeg-devel/2023-November/316552.html
        // Just use worker threads instead.
        // set to one thread to avoid ffmpeg crashing with worker threads
        // Not sure if it matters for audio, but it's a good idea to set it anyway
        "-threads",
        "1",
        "-y",
        `"${outputFile}"`,
      ],
      { shell: true }
    );

    ffmpegCommand.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
      } else {
        console.log(
          `Conversion successful for ${getFilename(inputFile)} to ${getFilename(
            outputFile
          )}`
        );
        resolve();
      }
    });

    ffmpegCommand.on("error", (error) => {
      console.error(
        `Error during conversion for ${getFilename(inputFile)} to ${getFilename(
          outputFile
        )}.`
      );
      failedFiles.push({ inputFile, outputFile, outputFormat });
      reject(err);
    });
  });
};
const getFilename = (filePath) => {
  const match = filePath.match(/[^\\]+$/);
  return match ? match[0] : "unknown";
};
// const { inputFile, outputFile, outputFormat } = workerData;

convert(inputFile, outputFile, outputFormat)
  .then(() => {
    parentPort.postMessage("Conversion completed");
  })
  .catch((err) => {
    parentPort.postMessage(`Error: ${err.message}`);
  });
