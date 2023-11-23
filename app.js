/*EZ GAME AUDIO CONVERSION*/

const readline = require('readline');
const { readdirSync, statSync, existsSync } = require('fs');
const { join, basename, extname, dirname} = require('path');
const { spawn } = require('child_process');

//setup object and functions.
let settings = {
    filePath: '',
    inputFormats: [],
    outputFormats: [],
    bitrate: 0,
    quality: 2,
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

//Starts with user input
const UserInputInitSettings = () => {
    return new Promise((resolve, reject) => {
        rl.question('Enter the full file path to start search. WILL SEARCH ALL SUB FOLDERS: ', async (filePath) => {
            if (filePath === '') handleError('Must specify file path!');
            settings.filePath = filePath;
            console.log(`File path: ${settings.filePath}`);
            rl.question('Enter the file extensions to look for. Leave blank for all (e.g., flac wav mp3 m4a ogg): ', (inputFormatString) => {
                settings.inputFormats = inputFormatString ? inputFormatString.toLowerCase().split(' ') : ['flac', 'wav', 'mp3', 'm4a', 'ogg'];
                if (settings.inputFormats.length === 0 || !settings.inputFormats.every(format => ['flac', 'wav', 'mp3', 'm4a', 'ogg'].includes(format))) {
                    reject('Invalid output format. Only mp3 wav m4a and flac are allowed.');
                }
                console.log(`Input formats: ${settings.inputFormats}`);

                rl.question('Enter the output formats. Leave blank for ogg (e.g., flac ogg mp3 m4a wav): ', (outputFormatString) => {
                    settings.outputFormats = outputFormatString ? outputFormatString.toLowerCase().split(' ') : ['flac', 'wav', 'mp3', 'm4a', 'ogg'];
                    if (settings.outputFormats.length === 0 || !settings.outputFormats.every(format => ['flac', 'wav', 'mp3', 'm4a', 'ogg'].includes(format))) {
                        reject('Invalid output format. Only flac ogg wav mp3 and m4a are allowed.');
                    }
                    console.log(`Output formats: ${settings.outputFormats}`);

                    // rl.question('Enter the audio quality for CBR from 32 to 320. Leave blank for 192 (e.g., 128): ', (bitrateNum) => {
                    //     const defaultBitrate = 192;
                    //     const bitrateNumFinal = bitrateNum || defaultBitrate;
                    //     settings.bitrate = parseInt(bitrateNumFinal);
                    //     if (isNaN(settings.bitrate) || settings.bitrate < 32 || settings.bitrate > 320) {
                    //         reject('Invalid bitrate. Must be 32-320.');
                    //     }
                    //     console.log(`Bitrate: ${settings.bitrate}`);

                    //     rl.question('Enter the audio quality for CBR from 0 to 9 for lowest. Leave blank for 2 (e.g., 2): ', (quality) => {
                    //         const defaultQuality = 2;
                    //         const qualityFinal = quality || defaultQuality;
                    //         settings.quality = parseInt(qualityFinal);
                    //         if (isNaN(settings.quality) || settings.quality < 0 || settings.quality > 9) {
                    //             reject('Invalid quality. quality must be 0-9.');
                    //         }
                    //         console.log(`quality: ${settings.quality}`);
                    //         console.log(settings)
                    //         resolve(settings);
                    //     })
                    // });
                console.log(settings)
                resolve(settings);
                });
            });
        });
    });
};
//Searches for files that meet criteria
const searchFiles = (settings) => {
    console.log('Settings:', settings);
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
                const fileExtension = extname(file).toLowerCase();
                if (fileExtensions.includes(fileExtension)) {
                    allFiles.push(filePath);
                }
            }
        }
    };

    walk(searchPath);

    console.log('Matching Files:', allFiles);

    return Promise.resolve(allFiles);
};

//deletes duplicate files with different extname
const deleteDuplicateFiles = (files) => {
    const priorityList = ['ogg', '.mp3', '.m4a', '.wav', '.flac'];
    //console.log('files', files);
    const fileobjs = files.map(file => [join(dirname(file), basename(file, extname(file))), extname(file)]);

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

//Create final list of files to convert and ask user for each file
const createConversionList = async (settings, files) => {
    const conversionList = [];
    let response = null;
    for (const inputFile of files) {
        for (const outputFormat of settings.outputFormats) {
            let outputFile = `${join(dirname(inputFile), basename(inputFile, extname(inputFile)))}.${outputFormat}`;
            //console.log(`${inputFile}`)
            //console.log(`${outputFile}`)
            let outputFileCopy = `${join(dirname(inputFile), `${basename(inputFile, extname(inputFile))} copy (1)`)}.${outputFormat}`;
            
                const responseActions = {
                    o: () => {return response = null;},
                    oa: () => {/* Nothing to do as default is overwrite */},
                    r: () => { outputFile = outputFileCopy; return response = null;},
                    ra: () => { outputFile = outputFileCopy;},
                    s: () => { outputFile = 'skipped!'; return response = null},
                    sa: () => { outputFile = 'skipped!'; }
                }
                switch (response) {
                    case '':break;
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
                        while (true){
                        if (!response){
                            if(existsSync(outputFile)) {
                            response = await getAnswer(`[O]verwrite, [R]ename or [S]kip. Add 'a' for all (e.g., oa, ra, sa)'\n'${outputFile}? : `);
                            response = response.trim().toLowerCase();
                            if (responseActions[response]) {
                                responseActions[response]();
                                break;
                            } else {
                                response = null;
                                console.log('You did not enter a valid selection, try again.');
                            }
                        }else break;
                        }
                    }
                }
                conversionList.push({
                    inputFile,
                    outputFile,
                    outputFormat,
                });
           
        }
    }
    while(true){
    console.log('Pending conversion:', conversionList);
    const accept_answer = await getAnswer('This is the list of files to be converted. Accept? Type yes or no: ');
    if(/^no$/i.test(accept_answer)) throw new Error('Conversion cancelled');
    if(!/^yes$/i.test(accept_answer)) {
        console.warn('invalid input, please use "yes" or "no"');
        continue;
    }
    return conversionList.filter(x => x.outputFile !== 'skipped!');
    }
};

//Use ffmpeg to convert files
const convertAudio2 = async (settings, files) => {
    const failedFiles = [];

    const convertWithRetry = async (inputFile, outputFile, outputFormat) => {
            try {
                await new Promise((resolve, reject) => {
                    const formatConfig = {
                        
                        'ogg': { codec: 'libopus' , additionalOptions: ['-b:a', '192k'] },
                        //https://slhck.info/video/2017/02/24/vbr-settings.html
                        //libopus 	-b:a 	6–8K (mono) 	– 	96K (for stereo) 	– 	-vbr on is default, -b:a just sets the target, see 
                        'mp3': { codec: 'libmp3lame', additionalOptions: ['-q:a', '3'] },
                        //libmp3lame 	-q:a 	9 	0 	4 	2 (~190kbps) 	Corresponds to lame -V.
                        'wav': { codec: 'pcm_s16le' },
                        'm4a': { codec: 'aac', additionalOptions: ['-q:a', `1.0`]},
                        //aac 	-q:a 	0.1 	2 	? 	1.3 (~128kbps) 	Is "experimental and [likely gives] worse results than CBR" according to FFmpeg Wiki. Ranges from 18 to 190kbps.
                        'flac': { codec: 'flac', additionalOptions: ['-compression_level', '8'] },
                    };
                    
                    const formatInfo = formatConfig[outputFormat];
                    
                    if (!formatInfo) {
                        console.error('Unsupported output format:', outputFormat);
                        return; // or handle the error in a way that suits your application
                    }
                    
                    const { codec, additionalOptions = [] } = formatInfo;
                    
                    const ffmpegCommand = spawn(join(__dirname, 'ffmpeg.exe'), [
                        //'-loglevel', 'debug',
                        '-i',
                        `"${inputFile}"`,
                        '-c:a',
                        codec,
                        ...additionalOptions,
                        '-y',
                        `"${outputFile}"`
                    ], { shell: true });

                    ffmpegCommand.on('close', (code) => {
                        if (code === 0) {
                            console.log(`Conversion successful for ${getFilename(inputFile)} to ${getFilename(outputFile)}`);
                            failedFiles.push({ inputFile, outputFile, outputFormat });
                            resolve();
                        }
                    });

                    ffmpegCommand.on('error', (err) => {
                        console.error(`Error during conversion for ${getFilename(inputFile)} to ${getFilename(outputFile)}.`);
                        failedFiles.push({ inputFile, outputFile, outputFormat });
                        reject(err);
                    });
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to convert ${getFilename(inputFile)} to ${getFilename(outputFile)}. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
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
    console.log('Have a nice day: ')
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
    // this is used to convert audio to m4a
    .then((files) => convertAudio2(settings, files))

    .then((files) => finalize())

    .catch((error) => {
        handleError(error);
    })
    .finally(() => {
        rl.close();
    });

