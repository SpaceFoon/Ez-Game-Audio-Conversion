const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

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
    return new Promise((resolve, reject) => {
        const fileExtensions = settings.inputFormats.map(format => `${format}`);
        const searchPath = settings.filePath;

        console.log('Search Path:', searchPath);
        console.log('File Extensions:', fileExtensions);

        fs.readdirSycn(searchPath, (err, files) => {
            if (err) {
                reject(err);
            } else {
                // Filter the files to only include those with matching extensions
                const matchingFiles = files.filter(file => {
                    const fileExtension = path.extname(file).toLowerCase();
                    return fileExtensions.includes(fileExtension);
                });

                // Create an array of file paths for the matching files
                const filePaths = matchingFiles.map(file => path.join(searchPath, file));

                // Assign the file paths to files.inputFiles
                files.inputFiles = filePaths;

                // Log the result
                console.log('Matching Files:', filePaths);

                // Resolve the promise with the modified files object
                resolve(files);
            }
        });
    });
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
            return path.join(path.dirname(inputFiles[0]), `${fileName}${ext}`);
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
    //.then((files) => deleteDuplicateFiles(files))
    .then((files) => createConversionList(settings, files))
    .catch((error) => {
        handleError(error);
    });
