// const fs = require('fs')
// const readline = require('readline');
// const ffmpeg = require('fluent-ffmpeg');
// const { join, basename, extname } = require('path');
// const {readdir, stat} = require('fs').promises;

// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
// });

// const fileList = {
//     filePath: '',
//     inputFormats: [],
//     outputFormats: [],
//     bitrate: 0,
//     files: [
//         {
//             inputPath: '',
//             outputFormat: '',
//         },
//     ],
// };

// const handleError = (message) => {
//     console.error(message);
//     process.exit(3);
// };

// const convertAudio = async (file) => {
//     return new Promise((resolve, reject) => {
//         const ffmpegCommand = ffmpeg();

//         ffmpegCommand.input(`"${file.filePath}"`);
//         ffmpegCommand
//             .audioCodec(fileList.outputFormats === 'ogg' ? 'libvorbis' : 'aac')
//             .audioBitrate(fileList.bitrate)
//             .toFormat(fileList.outputFormats)
//             .on('end', () => {
//                 console.log(`Converted ${file.filePath} to ${file.outputFormat} with bitrate ${file.bitrate}`);
//                 resolve(file.filePath);
//             })
//             .on('error', (err) => reject(err))
//             .save(file.filePath);
//     });
// };

// const findFiles = async (fileList) => {
//     const allFiles = [];

//     async function traverse(currentPath) {
//         const files = await readdir(currentPath);

//         for (const file of files) {
//             const filePath = join(currentPath, file);
//             const isDirectory = (await stat(filePath)).isDirectory();

//             if (isDirectory) {
//                 await traverse(filePath);
//             } else {
//                 allFiles.push(filePath);
//             }
//         }
//     }

//     await traverse(fileList.filePath);

//     const lowerCaseExtensions = Array.isArray(fileList.inputFormats)
//         ? fileList.inputFormats.map((ext) => ext.toLowerCase())
//         : [fileList.inputFormats.toLowerCase()];

//     const filteredFiles = allFiles.filter((file) => {
//         const lowerCaseFile = file.toLowerCase();
//         return lowerCaseExtensions.some((ext) => lowerCaseFile.endsWith(ext));
//     });

//     return filteredFiles.map(filePath => ({ filePath, fileName: basename(filePath, extname(filePath)) }));
// };

// const convertAllFiles = async (fileList) => {
//     try {
//         const files = await findFiles(fileList);

//         if (files.length === 0) {
//             console.log(`No files with specified input formats found in the specified folder:`, fileList.filePath);
//             rl.close();
//             return;
//         }

//         console.log(`Files to be converted (${fileList.inputFormats.join(', ')}):`);

//         const confirmedFiles = [];

//         for (const fileInfo of files) {
//             const file = {
//                 ...fileInfo,
//                 outputFormats: [...fileList.outputFormats],
//                 bitrate: fileList.bitrate,
//             };

//             fileList.files.push(file);

//             for (const outputFormat of file.outputFormats) {
//                 file.outputFormat = outputFormat;
//                 const outputFilePath = join(fileList.filePath, `${file.fileName}.${outputFormat}`);
//                 if (!fs.existsSync(outputFilePath)) {
//                     console.log(`${file.filePath} to ${outputFormat}`);
//                     await convertAudio(file);
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
// };

// rl.question('Enter the folder full path to start looking: ', async (filePath) => {
//     if (filePath === "") handleError('Must specify file path!');
//     fileList.filePath = filePath;

//     rl.question('Enter the file extensions to look for. Leave blank for all (e.g., mp3 wav): ', (inputFormatString) => {
//         rl.question('Enter the output formats. Leave blank for all (e.g., ogg m4a): ', (outputFormatString) => {
//             rl.question('Enter the audio bitrate. Leave blank for 192 (e.g., 128): ', (bitrateString) => {
//                 const lowerCaseOutputFormatString = outputFormatString.toLowerCase();
//                 fileList.outputFormats = lowerCaseOutputFormatString.includes('ogg') && lowerCaseOutputFormatString.includes('m4a')
//                     ? ['ogg', 'm4a']
//                     : outputFormatString.split(' ');

//                 const lowerCaseInputFormatString = inputFormatString.toLowerCase();
//                 fileList.inputFormats = lowerCaseInputFormatString.includes('mp3') && lowerCaseInputFormatString.includes('wav')
//                     ? ['mp3', 'wav']
//                     : inputFormatString.split(' ');

//                 const defaultBitrate = 192;
//                 const bitrateStringFinal = bitrateString || defaultBitrate;
//                 fileList.bitrate = parseInt(bitrateStringFinal);

//                 if (isNaN(fileList.bitrate) || fileList.bitrate < 64 || fileList.bitrate > 320 || fileList.inputFormats.length === 0 || fileList.outputFormats.length === 0) {
//                     handleError('Invalid input parameters. Please check your inputs. Bitrate must be 64-320.');
//                 }

//                 convertAllFiles(fileList);
//             });
//         });
//     });
// });

// const fs = require('fs').promises;
// const readline = require('readline');
// const ffmpeg = require('fluent-ffmpeg');
// const { join, basename, extname } = require('path');

// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
// });

// const fileList = {
//     filePath: '',
//     inputFormats: [],
//     outputFormats: [],
//     bitrate: 0,
//     files: [],
// };

// const handleError = (message) => {
//     console.error(message);
//     process.exit(3);
// };

// const convertAudio = async (fileList, file) => {
//     if (!fileList.inputFormats.includes(file.inputFormat) || !fileList.outputFormats.includes(file.outputFormat)) {
//         //console.log(`Skipping ${file.filePath} as it does not match specified formats.`);
//         return;
//     }

//     return new Promise((resolve, reject) => {
//         const ffmpegCommand = ffmpeg();

//         ffmpegCommand.input(`"${file.filePath}"`);
//         ffmpegCommand
//             .audioCodec(file.outputFormat === 'ogg' ? 'libvorbis' : 'aac')
//             .audioBitrate(file.bitrate)
//             .toFormat(file.outputFormat)
//             .on('end', () => {
//                 console.log(`Converted ${file.filePath} to ${file.outputFormat} with bitrate ${file.bitrate}`);
//                 resolve(file.filePath);
//             })
//             .on('error', (err) => reject(err))
//             .save(file.filePath);
//     });
// };

// const findFiles = async (fileList) => {
//     const allFiles = [];

//     async function traverse(currentPath) {
//         const files = await fs.readdir(currentPath);

//         for (const file of files) {
//             const filePath = join(currentPath, file);
//             const isDirectory = (await fs.stat(filePath)).isDirectory();

//             if (isDirectory) {
//                 await traverse(filePath);
//             } else {
//                 allFiles.push({ filePath, fileName: basename(filePath, extname(filePath)) });
//             }
//         }
//     }

//     await traverse(fileList.filePath);

//     const lowerCaseExtensions = Array.isArray(fileList.inputFormats)
//         ? fileList.inputFormats.map((ext) => ext.toLowerCase())
//         : [fileList.inputFormats.toLowerCase()];

//     const filteredFiles = allFiles.filter((file) => {
//         const lowerCaseFile = file.filePath.toLowerCase();
//         return lowerCaseExtensions.some((ext) => lowerCaseFile.endsWith(ext));
//     });

//     return filteredFiles;
// };

// const convertAllFiles = async (fileList) => {
//     try {
//         const files = await findFiles(fileList);

//         if (files.length === 0) {
//             console.log(`No files with specified input formats found in the specified folder:`, fileList.filePath);
//             rl.close();
//             return;
//         }

//         console.log(`Files found (${fileList.inputFormats.join(', ')}):`);
//         files.forEach((file) => {
//             console.log(file.filePath);
//         });
//         console.log('\nFiles to be converted:');

//         const confirmedFiles = [];
//         const skippedFiles = [];

//         for (const file of files) {
//             for (const outputFormat of fileList.outputFormats) {
//                 if (!fileList.outputFormats.includes(outputFormat)) {
//                     skippedFiles.push(`Skipping ${file.filePath} to ${outputFormat} as it does not match specified output formats.`);
//                     continue;
//                 }

//                 const fileToConvert = {
//                     ...file,
//                     outputFormat,
//                     bitrate: fileList.bitrate,
//                 };

//                 const outputFilePath = join(fileList.filePath, `${fileToConvert.fileName}.${outputFormat}`);

//                 try {
//                     await fs.promises.access(outputFilePath, fs.constants.F_OK);
//                     skippedFiles.push(`Skipping ${outputFilePath} as it already exists.`);
//                 } catch (error) {
//                     console.log(`${fileToConvert.filePath} to ${outputFormat}`);
//                     await convertAudio(fileList, fileToConvert);
//                     confirmedFiles.push(outputFilePath);
//                 }
//             }
//         }

//         console.log('\nConfirmed Files:');
//         confirmedFiles.forEach((confirmedFile) => {
//             console.log(confirmedFile);
//         });

//         if (skippedFiles.length > 0) {
//             console.log('\nSkipped Files:');
//             skippedFiles.forEach((skippedFile) => {
//                 console.log(skippedFile);
//             });
//         }

//         rl.close();
//     } catch (error) {
//         console.error('Error:', error);
//         rl.close();
//     }
// };

// rl.question('Enter the folder full path to start looking: ', async (filePath) => {
//     if (filePath === "") handleError('Must specify file path!');
//     fileList.filePath = filePath;

//     rl.question('Enter the file extensions to look for. Leave blank for all (e.g., mp3 wav): ', (inputFormatString) => {
//         rl.question('Enter the output formats. Leave blank for all (e.g., ogg m4a): ', (outputFormatString) => {
//             rl.question('Enter the audio bitrate. Leave blank for 192 (e.g., 128): ', (bitrateString) => {
//                 const lowerCaseOutputFormatString = outputFormatString.toLowerCase();
//                 fileList.outputFormats = lowerCaseOutputFormatString.includes('ogg') && lowerCaseOutputFormatString.includes('m4a')
//                     ? ['ogg', 'm4a']
//                     : outputFormatString.split(' ');

//                 const lowerCaseInputFormatString = inputFormatString.toLowerCase();
//                 fileList.inputFormats = lowerCaseInputFormatString.includes('mp3') && lowerCaseInputFormatString.includes('wav')
//                     ? ['mp3', 'wav']
//                     : inputFormatString.split(' ');

//                 const defaultBitrate = 192;
//                 const bitrateStringFinal = bitrateString || defaultBitrate;
//                 fileList.bitrate = parseInt(bitrateStringFinal);

//                 if (isNaN(fileList.bitrate) || fileList.bitrate < 64 || fileList.bitrate > 320 || fileList.inputFormats.length === 0 || fileList.outputFormats.length === 0) {
//                     handleError('Invalid input parameters. Please check your inputs. Bitrate must be 64-320.');
//                 }
//                 console.log('fileList', fileList);
//                 convertAllFiles(fileList);
//             });
//         });
//     });
// });
const fs = require('fs').promises;
const readline = require('readline');
const ffmpeg = require('fluent-ffmpeg');
const { join, basename, extname } = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const fileList = {
    filePath: '',
    inputFormats: [],
    outputFormats: [],
    bitrate: 0,
    files:[
        {
            
            outputFilePath
        }
    ]
};

const handleError = (message) => {
    console.error(message);
    process.exit(3);
};

const convertAudio = async (fileList, inputPath, outputFormat) => {
    return new Promise((resolve, reject) => {
        const outputFilePath = join(fileList.filePath, `${basename(inputPath, extname(inputPath))}.${outputFormat}`);

        const ffmpegCommand = ffmpeg(inputPath)
            .audioCodec(fileList.outputFormats.includes('ogg') ? 'libvorbis' : 'aac')
            .audioBitrate(fileList.bitrate)
            .toFormat(outputFormat)
            .on('end', () => {
                console.log(`Converted ${inputPath} to ${outputFormat} with bitrate ${fileList.bitrate}`);
                resolve(outputFilePath);
            })
            .on('error', (err) => reject(err))
            .save(outputFilePath);
    });
};

const findFiles = async (fileList) => {
    const allFiles = [];

    async function traverse(currentPath) {
        const files = await fs.readdir(currentPath);

        for (const file of files) {
            const filePath = join(currentPath, file);
            const isDirectory = (await fs.stat(filePath)).isDirectory();

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

    return filteredFiles;
};

const removeDuplicateBaseNames = (files) => {
    const fileMap = new Map();

    for (const file of files) {
        const key = basename(file, extname(file)).toLowerCase();
        const ext = extname(file).toLowerCase();

        if (!fileMap.has(key) || extname(fileMap.get(key)).length > ext.length) {
            fileMap.set(key, ext);
        }
    }

    return Array.from(fileMap.keys()).map((key) => ({
        inputPath: join(fileList.filePath, `${key}${fileMap.get(key)}`),
        outputFormats: [...fileList.outputFormats],
    }));
};

const generatePendingChanges = async (files) => {
    const pendingChanges = [];

    for (const file of files) {
        for (const outputFormat of file.outputFormats) {
            const outputFilePath = join(fileList.filePath, `${basename(file.inputPath, extname(file.inputPath))}.${outputFormat}`);
            if (!fs.existsSync(outputFilePath)) {
                pendingChanges.push({ inputPath: file.inputPath, outputFormat, outputFilePath });
            }
        }
    }

    return pendingChanges;
};

const applyChanges = async (pendingChanges) => {
    const confirmedFiles = [];

    for (const change of pendingChanges) {
        console.log(`${change.inputPath} to ${change.outputFormat}`);
        const confirmedFile = await convertAudio(fileList, change.inputPath, change.outputFormat);
        confirmedFiles.push(confirmedFile);
    }

    return confirmedFiles;
};

const printResults = (confirmedFiles) => {
    console.log('\nConfirmed Files:');
    confirmedFiles.forEach((confirmedFile) => {
        console.log(confirmedFile);
    });
};

const processFolder = async () => {
    try {
        const files = await findFiles(fileList);

        if (files.length === 0) {
            console.log(`No files with specified input formats found in the specified folder:`, fileList.filePath);
            rl.close();
            return;
        }

        //console.log(`Files found (${fileList.inputFormats.join(', ')}):`);
        files.forEach((file) => {
            //console.log(file);
        });

        const uniqueFiles = removeDuplicateBaseNames(files);
        const pendingChanges = await generatePendingChanges(uniqueFiles);

        console.log('\nPending Changes:');
        pendingChanges.forEach((change) => {
            console.log(`Action: convert, Input: ${change.inputPath}, Output: ${change.outputFilePath}`);
        });

        const confirmedFiles = await applyChanges(pendingChanges);

        printResults(confirmedFiles);
        rl.close();
    } catch (error) {
        console.error('Error:', error);
        rl.close();
    }
};

rl.question('Enter the folder full path to start looking: ', async (filePath) => {
    if (filePath === '') handleError('Must specify file path!');
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

                processFolder();
            });
        });
    });
});
// const fs = require('fs').promises;
// const readline = require('readline');
// const { join, basename, extname } = require('path');

// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
// });

// const fileList = {
//     filePath: '',
//     inputFormats: [],
// };

// const findFiles = async (fileList) => {
//     const allFiles = [];

//     async function traverse(currentPath) {
//         const files = await fs.readdir(currentPath);

//         for (const file of files) {
//             const filePath = join(currentPath, file);
//             const isDirectory = (await fs.stat(filePath)).isDirectory();

//             if (isDirectory) {
//                 await traverse(filePath);
//             } else {
//                 allFiles.push(filePath);
//             }
//         }
//     }

//     await traverse(fileList.filePath);

//     const lowerCaseExtensions = Array.isArray(fileList.inputFormats)
//         ? fileList.inputFormats.map((ext) => ext.toLowerCase())
//         : [fileList.inputFormats.toLowerCase()];

//     const filteredFiles = allFiles.filter((file) => {
//         const lowerCaseFile = file.toLowerCase();
//         return lowerCaseExtensions.some((ext) => lowerCaseFile.endsWith(ext));
//     });

//     return filteredFiles;
// };

// const printFiles = async () => {
//     try {
//         const files = await findFiles(fileList);

//         if (files.length === 0) {
//             console.log(`No files with specified input formats found in the specified folder:`, fileList.filePath);
//             rl.close();
//             return;
//         }

//         console.log(`Files found (${fileList.inputFormats.join(', ')}):`);
//         files.forEach((file) => {
//             console.log(file);
//         });

//         rl.close();
//     } catch (error) {
//         console.error('Error:', error);
//         rl.close();
//     }
// };

// rl.question('Enter the folder full path to start looking: ', async (filePath) => {
//     if (filePath === '') {
//         console.error('Must specify file path!');
//         rl.close();
//         return;
//     }

//     fileList.filePath = filePath;

//     rl.question('Enter the file extensions to look for. Leave blank for all (e.g., mp3 wav): ', (inputFormatString) => {
//         const lowerCaseInputFormatString = inputFormatString.toLowerCase();
//         fileList.inputFormats = lowerCaseInputFormatString.includes('mp3') && lowerCaseInputFormatString.includes('wav')
//             ? ['mp3', 'wav']
//             : inputFormatString.split(' ');

//         printFiles();
//     });
// });
