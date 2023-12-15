// Use ffmpeg to convert files
//import { spawn } from "child_process";
import { Command } from "@tauri-apps/api/shell";
import { invoke } from "@tauri-apps/api/tauri";
import { join } from "@tauri-apps/api/path";
//import { path } from "@tauri-apps/api/path";
export default async function convertAudio(
  inputFile,
  outputFile,
  outputFormat
) {
  const failedFiles = [];
  const ffmpegPath = Command.sidecar("/src/bin/ffmpeg");
  console.log("ffmpegPath", ffmpegPath);
  const convertFiles = async (inputFile, outputFile, outputFormat) => {
    try {
      await window.tauri.invoke("convert_audio", {
        input_file: inputFile,
        output_file: outputFile,
        output_format: codec,
        additional_options: additionalOptions,
      });
      console.log(
        `Conversion successful for ${getFilename(inputFile)} to ${getFilename(
          outputFile
        )}`
      );
    } catch (error) {
      failedFiles.push({ inputFile, outputFile, outputFormat });
      console.error("failed", error);
    }
    // `Failed to convert ${getFilename(inputFile)} to ${getFilename(outputFile
    // )}`);
    // await new Promise((resolve, reject) => {
    //   const formatConfig = {
    //     ogg: { codec: "libopus", additionalOptions: ["-b:a", "192k"] },
    //     //https://slhck.info/video/2017/02/24/vbr-settings.html
    //     //libopus 	-b:a 	6–8K (mono) 	– 	96K (for stereo) 	– 	-vbr on is default, -b:a just sets the target, see
    //     mp3: { codec: "libmp3lame", additionalOptions: ["-q:a", "3"] },
    //     //libmp3lame 	-q:a 	9 	0 	4 	2 (~190kbps) 	Corresponds to lame -V.
    //     wav: { codec: "pcm_s16le" },
    //     m4a: { codec: "aac", additionalOptions: ["-q:a", `1.0`] },
    //     //aac 	-q:a 	0.1 	2 	? 	1.3 (~128kbps) 	Is "experimental and [likely gives] worse results than CBR" according to FFmpeg Wiki. Ranges from 18 to 190kbps.
    //     flac: {
    //       codec: "flac",
    //       additionalOptions: ["-compression_level", "8"],
    //     },
    //   };

    const formatInfo = formatConfig[outputFormat];

    if (!formatInfo) {
      console.error("Unsupported output format:", outputFormat);
      return;
    }

    const { codec, additionalOptions = [] } = formatInfo;
  };

  // const ffmpegCommand = Command(
  //   join(__dirname, "ffmpeg.exe"),
  //   [
  //     //'-loglevel', 'debug',
  //     "-i",
  //     `"${inputFile}"`,
  //     "-c:a",
  //     codec,
  //     ...additionalOptions,
  //     "-y",
  //     `"${outputFile}"`,
  //   ],
  //   { shell: true }
  // );

  //         ffmpegCommand.on("close", (code) => {
  //           if (code === 0) {
  //             console.log(
  //               `Conversion successful for ${getFilename(
  //                 inputFile
  //               )} to ${getFilename(outputFile)}`
  //             );
  //             failedFiles.push({ inputFile, outputFile, outputFormat });
  //             resolve();
  //           }
  //         });

  //         ffmpegCommand.on("error", (err) => {
  //           console.error(
  //             `Error during conversion for ${getFilename(
  //               inputFile
  //             )} to ${getFilename(outputFile)}.`
  //           );
  //           failedFiles.push({ inputFile, outputFile, outputFormat });
  //           reject(err);
  //         });
  //       });
  //       await new Promise((resolve) => setTimeout(resolve, 1000));
  //     } catch (error) {
  //       console.error(
  //         `Failed to convert ${getFilename(inputFile)} to ${getFilename(
  //           outputFile
  //         )}. Retrying...`
  //       );
  //       await new Promise((resolve) => setTimeout(resolve, 1000));
  //     }
  //   };
  //   for (const { inputFile, outputFile, outputFormat } of files) {
  //     await convertFiles(inputFile, outputFile, outputFormat);
  //   }

  //   console.log("Failed files:", failedFiles);
  // }
  async function getFilename(filePath) {
    const match = filePath.match(/[^\\]+$/);
    return match ? match[0] : "unknown";
  }
}
