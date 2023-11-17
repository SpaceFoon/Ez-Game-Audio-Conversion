// const fs = require('fs');
// const readline = require('readline');
// const ffmpeg = require('fluent-ffmpeg');
// const path = require('path');
// const { stringify } = require('querystring');

// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
// });
// let fileList = {
//     filePath: '',
//     inputFormat: '',
//     outputFormat: '',
//     bitrate: 0,
//     file: {
//         fileName: '',
//         filePath: '',
//     }
// };
// function convertAudio(fileList) {
//     return new Promise((resolve, reject) => {
//         const ffmpegCommand = ffmpeg();

//         ffmpegCommand.input(`"${fileList.filePath}"`); // Enclose input file path in double quotes
//         ffmpegCommand
//             .audioCodec(outputFormat === 'ogg' ? 'libvorbis' : 'aac')
//             .audioBitrate(bitrate)
//             .toFormat(format)
//             .on('end', () => {
//                 console.log(`Converted ${fileList.filePath} to ${fileList.outputFormat} with bitrate ${fileList.bitrate}`);
//                 resolve(outputPath);
//             })
//             .on('error', (err) => reject(err))
//             .save(fileList.filePath);
//     });
// }

// function findFiles(fileList) {
//     return new Promise((resolve, reject) => {
//         const allFiles = [];

//         function traverse(currentPath) {
//             const files = fs.readdirSync(currentPath);

//             files.forEach((file) => {
//                 const filePath = path.join(currentPath, file);
//                 const isDirectory = fs.statSync(filePath).isDirectory();

//                 if (isDirectory) {
//                     traverse(filePath);
//                 } else {
//                     allFiles.push(filePath);
//                 }
//             });
//         }

//         traverse(filePath);

//         const lowerCaseExtensions = Array.isArray(inputFormat)
//             ? inputFormat.map((ext) => ext.toLowerCase())
//             : [inputFormat.toLowerCase()];

//         const filteredFiles = allFiles.filter((file) => {
//             const lowerCaseFile = file.toLowerCase();
//             return lowerCaseExtensions.some((ext) => lowerCaseFile.endsWith(ext));
//         });

//         resolve(filteredFiles);
//     });
// }

// async function convertAllFiles(fileList) {
//     try {
//         const files = await findFiles(filePath, inputFormat);

//         if (files.length === 0) {
//             console.log(`No files with extensions ${inputFormat.join(', ')} found in the specified folder:`,filePath);
//             rl.close();
//             return;
//         }

//         console.log(`Files to be converted (${inputFormat.join(', ')}):`);

//         const confirmedFiles = [];

//         for (const file of files) {
//             const decodedFilePath = decodeURI(file); // Decode the file path
//             const fileName = path.basename(decodedFilePath, path.extname(decodedFilePath));

//             for (const outputFormat of outputFormat) {
//                 const outputFilePath = path.join(filePath, `${fileName}.${format}`);
//                 // Check if the corresponding outputFormat file already exists
//                 if (!fs.existsSync(outputFilePath)) {
//                     console.log(`${decodedFilePath} to ${outputFormat}`);
//                     await convertAudio(decodedFilePath, outputFilePath, outputFormat, bitrate);
//                     confirmedFiles.push(outputFilePath);
//                 }
//             }
//         }

//         console.log('Confirmed Files:');
//         confirmedFiles.forEach((confirmedFile) => {
//             console.log(confirmedFile);
//         });

//         rl.close();
//     } catch (error) {
//         console.error('Error:', error);
//         rl.close();
//     }
// }

// // Ask the user for the folder path, file extensions, desired outputFormats, and bitrate
// rl.question('Enter the folder full path to start looking: ', (filePath) => {
//     const handleError = (message) => {
//         console.error(message);
//         process.exit(3);
//     };
//     if (filePath === "") handleError('Must specify file path!');
//     fileList.filePath =filePath;
//     rl.question('Enter the file extensions to look for. Leave blank for all (e.g., mp3 wav): ', (inputFormatString) => {
//         rl.question('Enter the output formats. Leave blank for all (e.g., ogg m4a): ', (outputFormatString) => {
//             rl.question('Enter the audio bitrate. Leave blank for 192 (e.g., 128): ', (bitrateString) => {
//                 const lowerCaseoutputFormatString = outputFormatString.toLowerCase();
//                 fileList.outputFormats = lowerCaseoutputFormatString.includes('ogg') && lowerCaseoutputFormatString.includes('m4a')
//                     ? ['ogg', 'm4a']
//                     : outputFormatString.split(' ');

//                 const lowerCaseinputFormatString = inputFormatString.toLowerCase();
//                 fileList.inputFormat = lowerCaseinputFormatString.includes('mp3') && lowerCaseinputFormatString.includes('wav')
//                     ? ['mp3', 'wav']
//                     : inputFormatString.split(' ');

//                 const defaultBitrate = '192';
//                 const bitrateStringFinal = bitrateString || defaultBitrate;
//                 fileList.bitrate = parseInt(bitrateStringFinal);

//                 if (isNaN(bitrate) || bitrate < 64 || bitrate > 320 || inputFormat.length === 0 || outputFormats.length === 0) {
//                     handleError('Invalid input parameters. Please check your inputs. Bitrate must be 64-320.');

//                 }

//                 convertAllFiles(filePath, fileList);
//             });
//         });
//     });
// });

// // Decode URI function
// const decodeURI = (uri) => {
//   return uri.replace(/%[0-9A-F]{2}/g, match => String.fromCharCode('0x' + match.slice(1)));
// };



const readline = require('readline');
const ffmpeg = require('fluent-ffmpeg');
const { join, basename, extname } = require('path');
const {existsSync, readdir, stat} = require('fs').promises;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const fileList = {
    filePath: '',
    inputFormats: [],
    outputFormats: [],
    bitrate: 0,
    files: [
        {
            inputPath: '',
            outputFormat: '',
        },
    ],
};

const handleError = (message) => {
    console.error(message);
    process.exit(3);
};

const convertAudio = async (file) => {
    return new Promise((resolve, reject) => {
        const ffmpegCommand = ffmpeg();

        ffmpegCommand.input(`"${file.filePath}"`);
        ffmpegCommand
            .audioCodec(fileList.outputFormats === 'ogg' ? 'libvorbis' : 'aac')
            .audioBitrate(fileList.bitrate)
            .toFormat(fileList.outputFormats)
            .on('end', () => {
                console.log(`Converted ${file.filePath} to ${file.outputFormat} with bitrate ${file.bitrate}`);
                resolve(file.filePath);
            })
            .on('error', (err) => reject(err))
            .save(file.filePath);
    });
};

const findFiles = async (fileList) => {
    const allFiles = [];

    async function traverse(currentPath) {
        const files = await readdir(currentPath);

        for (const file of files) {
            const filePath = join(currentPath, file);
            const isDirectory = (await stat(filePath)).isDirectory();

            if (isDirectory) {
                await traverse(filePath);
            } else {
                allFiles.push(filePath);
            }
        }
    }

    await traverse(fileList.filePath);

    const lowerCaseExtensions = Array.isArray(fileList.inputFormats)
        ? fileList.inputFormats.map((ext) => ext.toLowerCase())
        : [fileList.inputFormats.toLowerCase()];

    const filteredFiles = allFiles.filter((file) => {
        const lowerCaseFile = file.toLowerCase();
        return lowerCaseExtensions.some((ext) => lowerCaseFile.endsWith(ext));
    });

    return filteredFiles.map(filePath => ({ filePath, fileName: basename(filePath, extname(filePath)) }));
};

const convertAllFiles = async (fileList) => {
    try {
        const files = await findFiles(fileList);

        if (files.length === 0) {
            console.log(`No files with specified input formats found in the specified folder:`, fileList.filePath);
            rl.close();
            return;
        }

        console.log(`Files to be converted (${fileList.inputFormats.join(', ')}):`);

        const confirmedFiles = [];

        for (const fileInfo of files) {
            const file = {
                ...fileInfo,
                outputFormats: [...fileList.outputFormats],
                bitrate: fileList.bitrate,
            };

            fileList.files.push(file);

            for (const outputFormat of file.outputFormats) {
                file.outputFormat = outputFormat;
                const outputFilePath = join(fileList.filePath, `${file.fileName}.${outputFormat}`);
                if (!existsSync(outputFilePath)) {
                    console.log(`${file.filePath} to ${outputFormat}`);
                    await convertAudio(file);
                    confirmedFiles.push(outputFilePath);
                }
            }
        }

        console.log('Confirmed Files:');
        confirmedFiles.forEach((confirmedFile) => {
            console.log(confirmedFile);
        });

        rl.close();
    } catch (error) {
        console.error('Error:', error);
        rl.close();
    }
};

rl.question('Enter the folder full path to start looking: ', async (filePath) => {
    if (filePath === "") handleError('Must specify file path!');
    fileList.filePath = filePath;

    rl.question('Enter the file extensions to look for. Leave blank for all (e.g., mp3 wav): ', (inputFormatString) => {
        rl.question('Enter the output formats. Leave blank for all (e.g., ogg m4a): ', (outputFormatString) => {
            rl.question('Enter the audio bitrate. Leave blank for 192 (e.g., 128): ', (bitrateString) => {
                const lowerCaseOutputFormatString = outputFormatString.toLowerCase();
                fileList.outputFormats = lowerCaseOutputFormatString.includes('ogg') && lowerCaseOutputFormatString.includes('m4a')
                    ? ['ogg', 'm4a']
                    : outputFormatString.split(' ');

                const lowerCaseInputFormatString = inputFormatString.toLowerCase();
                fileList.inputFormats = lowerCaseInputFormatString.includes('mp3') && lowerCaseInputFormatString.includes('wav')
                    ? ['mp3', 'wav']
                    : inputFormatString.split(' ');

                const defaultBitrate = 192;
                const bitrateStringFinal = bitrateString || defaultBitrate;
                fileList.bitrate = parseInt(bitrateStringFinal);

                if (isNaN(fileList.bitrate) || fileList.bitrate < 64 || fileList.bitrate > 320 || fileList.inputFormats.length === 0 || fileList.outputFormats.length === 0) {
                    handleError('Invalid input parameters. Please check your inputs. Bitrate must be 64-320.');
                }

                convertAllFiles(fileList);
            });
        });
    });
});