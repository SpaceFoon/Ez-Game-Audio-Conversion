/*
EZ GAME AUDIO CONVERSION

https://rpgmaker.net/articles/2633/
RMMV uses m4a as well but not really needed in 2023

Features	        MP3	Ogg	WAV	MIDI
Loop OK	NO	        YES	YES	YES
Loop Inside (Tags)	NO	YES	NO	YES
File Size Optimize.	YES	YES	NO	OMG YES
Realistic Sound	    YES	YES	YES	NO
RMMV Compatible	    NO	YES	NO	NO
RMVX/Ace Compatible	YES	YES	YES	YES
RMXP Compatible	    YES	YES	YES	YES
RM2003 Compatible	YES	NO	YES	YES

M4A files are compressed using the 'AAC' lossy

*/

const ffmpeg = require('fluent-ffmpeg');
// const ffmpeg = require('ffmpeg');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { readdirSync, statSync } = require('fs');
const { join, basename, extname } = require('path');
const { spawn } = require('child_process');
// const pathToFfmpeg = require('.')

//setup object and functions.
let settings = {
    filePath: '',
    inputFormats: [],
    outputFormats: [],
    bitrate: 0,
};

const handleError = (errorMessage) => {
    console.error(errorMessage);
    process.exit(1);
};

const getAnswer = async (question) => new Promise((res, rej) => rl.question(question, ans => res(ans)))

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

                    rl.question('Enter the audio bitrate from 32 to 320. Leave blank for 192 (e.g., 128): ', (bitrateString) => {
                        const defaultBitrate = 192;
                        const bitrateStringFinal = bitrateString || defaultBitrate;
                        settings.bitrate = parseInt(bitrateStringFinal);
                        if (isNaN(settings.bitrate) || settings.bitrate < 32 || settings.bitrate > 320) {
                            reject('Invalid bitrate. Bitrate must be 32-320.');
                        }
                        console.log(`Bitrate: ${settings.bitrate}`);
                        resolve(settings);
                    });
                });
            });
        });
    });
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
    return Promise.resolve(allFiles);
};

const deleteDuplicateFiles = (files) => {
    const priorityList = ['.mp3', '.wav'];
    //console.log('files', files);
    const fileobjs = files.map(file => [path.join(path.dirname(file), path.basename(file, path.extname(file))), path.extname(file)]);

    const uniq = new Map();

    for (const [name, ext] of fileobjs) {
        //console.log('name :>> ', name);
        //console.log('ext :>> ', ext);
        if(!uniq.has(name)) {
            uniq.set(name, ext);
            continue;
        }

        const current = uniq.get(name);
        // console.log('current :>> ', current);
        // console.log('priorityList.indexOf(ext) :>> ', priorityList.indexOf(ext));
        // console.log('priorityList.indexOf(current) :>> ', priorityList.indexOf(current));
        // console.log('priorityList.indexOf(ext) > priorityList.indexOf(current) :>> ', priorityList.indexOf(ext) > priorityList.indexOf(current));
        if(priorityList.indexOf(ext) > priorityList.indexOf(current)){
            uniq.set(name, ext)
        }
    }

    return Array.from(uniq.entries()).reduce((p,c) => [...p, `${c[0]}${c[1]}`], [])

};

const createConversionList = async (settings, files) => {
    const conversionList = [];
    let response = null;
    for (const inputFile of files) {
        for (const outputFormat of settings.outputFormats) {
            let outputFile = `${path.join(path.dirname(inputFile), path.basename(inputFile, path.extname(inputFile)))}.${outputFormat}`;
            //console.log(`${inputFile}`)
            //console.log(`${outputFile}`)
            let outputFileCopy = `${path.join(path.dirname(inputFile), `${path.basename(inputFile, path.extname(inputFile))} copy (1)`)}.${outputFormat}`;
            if(outputFile) {
                const responseActions = {
                    o: () => {return response = null;},
                    oa: () => {/* Nothing to do as default is overwrite */},
                    r: () => { outputFile = outputFileCopy; return response = null;},//copies fail to convert
                    ra: () => { outputFile = outputFileCopy;},
                    s: () => { outputFile = 'skipped!'; return response = null},
                    sa: () => { outputFile = 'skipped!'; }
                }
                switch (response) {
                    case 'ra':
                        responseActions['ra']();
                        break;
                    case 'sa':
                        responseActions['sa']();
                        break;
                    case 'oa':
                        console.log('OVERWRITE FILE', outputFile);
                        break;
                    default:
                        console.log('response: ',response)
                        while (true){
                        if (!response){
                            response = await getAnswer(`[O]verwrite, [R]ename or [S]kip. Add 'a' for all (e.g., oa, ra, sa)'\n'${outputFile}? : `);
                            response = response.trim().toLowerCase();
                            if (responseActions[response]) {
                                responseActions[response]();
                                break;
                            } else {
                                response = null;
                                console.log('You did not enter a valid selection, try again.');
                            }
                        }
                    }
                }
                conversionList.push({
                    inputFile,
                    outputFile,
                    outputFormat,
                });
            }else{console.error("file does not exist")}
        }
    }

    console.log('Pending conversion:', conversionList);
    const accept_answer = await getAnswer('This is the list of files to be converted. Accept? Type yes or no: ');
    if(/^no$/i.test(accept_answer)) throw new Error('Conversion cancelled');
    if(!/^yes$/i.test(accept_answer)) throw new Error('invalid input, please use "yes" or "no"');
    return conversionList.filter(x => x.outputFile !== 'skipped!');
};

const checkFileCodec = (files) => {

array.forEach(files => {
    ffmpeg.ffprobe(files[i], (err, metadata) => {
      if (err) {
        console.error('Error while probing:', err);
      } else {
        // Access the codec information from the metadata object
        const audioCodec = metadata.streams.find(stream => stream.codec_type === 'audio').codec_name;
        const videoCodec = metadata.streams.find(stream => stream.codec_type === 'video').codec_name;
    
        console.log('Audio codec:', audioCodec);
        console.log('Video codec:', videoCodec);
      }
    });
    })
};

// const checkFileNames = async (files, conversionList) => {
//     try {
//         for (const { inputFile, outputFile, outputFormat } of files) {
//             try {
//                 if (outputFile) {
//                     const sanitizedOutputFile = outputFile.replace(/ /g, '_');
//                     const index = conversionList.findIndex(item => item.outputFile === outputFile);
//                     if (index !== -1) {
//                         conversionList[index].outputFile = sanitizedOutputFile;
//                     }
//                 } else {
//                     throw new Error(`outputFile is undefined or null for an entry: ${outputFile}`);
//                 }
//             } catch (error) {
//                 console.error(error.message);
//             }
//         }
//     } catch (error) {
//         throw error;
//     }
// };

const convertAudio2 = async (settings, files) => {
    const maxRetries = 3;
    const failedFiles = [];

    const convertWithRetry = async (inputFile, outputFile, outputFormat) => {
        let retryCount = 0;
        let success = false;

        while (!success && retryCount < maxRetries) {
            try {
                await new Promise((resolve, reject) => {
                    const ffmpegCommand = spawn(path.join(__dirname, 'ffmpeg.exe'), [
                        '-i',
                        `"${inputFile}"`,
                        '-c:a',
                        outputFormat === 'ogg' ? 'libopus' : 'aac',
                        '-b:a',
                        `${settings.bitrate.toString()}k`,
                        '-y',
                        `"${outputFile}"`
                    ], { shell: true });

                    ffmpegCommand.on('close', (code) => {
                        if (code === 0) {
                            console.log(`Conversion successful for ${getFilename(inputFile)} to ${getFilename(outputFile)}`);
                            success = true;
                            resolve();
                        } else {
                            console.error(`Conversion failed for ${getFilename(inputFile)} to ${getFilename(outputFile)}. Exit code: ${code}`);
                            retryCount++;
                            console.log(`Retrying... (Attempt ${retryCount}/${maxRetries})`);
                            reject(new Error(`Conversion failed for ${inputFile}. Exit code: ${code}`));
                        }
                    });

                    ffmpegCommand.on('error', (err) => {
                        console.error(`Error during conversion for ${getFilename(inputFile)} to ${getFilename(outputFile)}. Retrying...`);
                        retryCount++;
                        console.log(`Retrying... (Attempt ${retryCount}/${maxRetries})`);
                        reject(err);
                    });
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to convert ${getFilename(inputFile)} to ${getFilename(outputFile)}. Retrying...`);
                retryCount++;
                console.log(`Retrying... (Attempt ${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (!success) {
            console.error(`Failed to convert ${getFilename(inputFile)} to ${getFilename(outputFile)} after ${maxRetries} retries.`);
            failedFiles.push({ inputFile, outputFile, outputFormat });
        }
    };

    for (const { inputFile, outputFile, outputFormat } of files) {
        await convertWithRetry(inputFile, outputFile, outputFormat);
    }

    console.log('Failed files:', failedFiles);
};

const getFilename = (filePath) => {
    const match = filePath.match(/[^\\]+$/);
    return match ? match[0] : 'unknown';
};

  finalize = (files) => {
    console.log('Have a nice day: ',files)
  }
UserInputInitSettings()
    // find all files of specified type in provided folder and all subfolders
    .then((settings) => searchFiles(settings))
    //delete files from the list that have the same name but different file extensions.
    //save the file that has the best format. Flac > wav > m4a > mp3
    .then((files) => deleteDuplicateFiles(files))
    //go through lis of input files and make output list.
    //there can be multiple outputs and user input is needed here for output files
    // that already exist.
    // find and replace spaces in files names
    //.then((files) => checkFileNames(files))
    .then((files) => createConversionList(settings, files))
    //This is needed to decided what codec to use for the conversion.
    /////////////////.then((files) => checkFileCodec(files))
    
    // this is used to convert audio to m4a
    .then((files) => convertAudio2(settings, files))

    .then((files) => finalize(files))

    .catch((error) => {
        handleError(error);
    })
    .finally(() => {
        console.log('.finally');
        rl.close();
    });

