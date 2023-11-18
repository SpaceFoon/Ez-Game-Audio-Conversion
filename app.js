const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { readdirSync, statSync } = require('fs');
const { join, basename, extname } = require('path');

let settings = {
    filePath: '',
    inputFormats: [],
    outputFormats: [],
    bitrate: 0,
};
let files = {
    inputFiles: [],
    outputFiles: []
}
const handleError = (errorMessage) => {
    console.error(errorMessage);
    process.exit(1);
};
const searchFiles = (settings) => {
    const fileExtensions = settings.inputFormats.map(format => `.${format}`);
    const searchPath = settings.filePath;

    console.log('Search Path:', searchPath);
    console.log('File Extensions:', fileExtensions);

    const allFiles = [];

    const walk = (dir) => {
        const files = readdirSync(dir);

        for (const file of files) {
            const filePath = join(dir, file);
            const stats = statSync(filePath);

            if (stats.isDirectory()) {
                // Recursively walk into subdirectories
                walk(filePath);
            } else {
                // Check if the file has a matching extension
                const fileExtension = path.extname(file).toLowerCase();
                if (fileExtensions.includes(fileExtension)) {
                    allFiles.push(filePath);
                }
            }
        }
    };

    walk(searchPath);

    console.log('Matching Files:', allFiles);

    // Resolve the promise with the list of matching file paths
    return Promise.resolve({ inputFiles: allFiles });
};

const deleteDuplicateFiles = (files) => {
    return new Promise((resolve, reject) => {
        const fileMap = new Map();

        for (const file of files.inputFiles) {
            const fileName = path.basename(file, path.extname(file));
            const ext = path.extname(file).toLowerCase();

            if (!fileMap.has(fileName) || ext.length > path.extname(fileMap.get(fileName)).length) {
                fileMap.set(fileName, ext);
            } else {
                console.warn(`Deleted from list: ${file}`); // Log the deleted file
            }
        }

        const uniqueFiles = Array.from(fileMap.keys()).map((fileName) => {
            const ext = fileMap.get(fileName);
            return path.join(path.dirname(files.inputFiles[0]), `${fileName}${ext}`);
        });

        files.inputFiles = uniqueFiles;
        resolve(files);
    });
};

const createConversionList = (settings, files) => {
    return new Promise((resolve, reject) => {
        const conversionList = [];

        for (const inputFile of files.inputFiles) {
            for (const outputFormat of settings.outputFormats) {
                const outputFile = `${path.basename(inputFile, path.extname(inputFile))}.${outputFormat}`;
                conversionList.push({
                    inputFile,
                    outputFile,
                    outputFormat
                });
            }
        }
        console.log('Pending conversion:', conversionList);

        rl.question('This is the list of files to be converted. Accept? Type yes or no: ', (input) => {
            input.toLowerCase();
            if (input === 'yes') {
                console.log('Conversion accepted.');
                resolve(conversionList);
            } else {
                console.log('Conversion canceled.');
                reject('Conversion canceled.');
            }
        });
    });
};

const convertAudio = async (settings, files) => {
    return new Promise((resolve, reject) => {
        const outputFilePath = join(settings.filePath, `${basename(inputPath, extname(inputPath))}.${outputFormat}`);

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

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const UserInputInitSettings = () => {
    return new Promise((resolve, reject) => {
        rl.question('Enter the full file path to start search. WILL SEARCH ALL SUB FOLDERS: ', async (filePath) => {
            if (filePath === '') handleError('Must specify file path!');
            settings.filePath = filePath;
            console.log(`File path: ${settings.filePath}`);
            rl.question('Enter the file extensions to look for. Leave blank for all (e.g., mp3 wav): ', (inputFormatString) => {
                settings.inputFormats = inputFormatString ? inputFormatString.toLowerCase().split(' ') : ['mp3', 'wav'];
                if (settings.inputFormats.length === 0 || !settings.inputFormats.every(format => ['mp3', 'wav'].includes(format))) {
                    reject('Invalid output format. Only mp3 and wav are allowed.');
                }
                console.log(`Input formats: ${settings.inputFormats}`);

                rl.question('Enter the output formats. Leave blank for all (e.g., ogg m4a): ', (outputFormatString) => {
                    settings.outputFormats = outputFormatString ? outputFormatString.toLowerCase().split(' ') : ['ogg', 'm4a'];
                    if (settings.outputFormats.length === 0 || !settings.outputFormats.every(format => ['ogg', 'm4a'].includes(format))) {
                        reject('Invalid output format. Only ogg and m4a are allowed.');
                    }
                    console.log(`Output formats: ${settings.outputFormats}`);

                    rl.question('Enter the audio bitrate from 64 to 320. Leave blank for 192 (e.g., 128): ', (bitrateString) => {
                        const defaultBitrate = 192;
                        const bitrateStringFinal = bitrateString || defaultBitrate;
                        settings.bitrate = parseInt(bitrateStringFinal);
                        if (isNaN(settings.bitrate) || settings.bitrate < 64 || settings.bitrate > 320) {
                            reject('Invalid bitrate. Bitrate must be 64-320.');
                        }
                        console.log(`Bitrate: ${settings.bitrate}`);
                        resolve(settings);
                    });
                });
            });
        });
    });
};

UserInputInitSettings()
    .then((settings) => searchFiles(settings))
    .then((files) => deleteDuplicateFiles(files))
    .then((files) => createConversionList(settings, files))
    .then((files) => convertAudio(settings, files))
    .catch((error) => {
        handleError(error);
    });
