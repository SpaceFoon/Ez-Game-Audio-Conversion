const ffmpeg = require('fluent-ffmpeg');
// const ffmpeg = require('ffmpeg');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { readdirSync, statSync } = require('fs');
const { join, basename, extname } = require('path');
const { spawn } = require('child_process');
// const pathToFfmpeg = require('.')
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
    console.log('files', files);
    const fileobjs = files.map(file => [path.join(path.dirname(file), path.basename(file, path.extname(file))), path.extname(file)]);

    const uniq = new Map();

    for (const [name, ext] of fileobjs) {
        console.log('name :>> ', name);
        console.log('ext :>> ', ext);
        if(!uniq.has(name)) {
            uniq.set(name, ext);
            continue;
        }

        const current = uniq.get(name);
        console.log('current :>> ', current);
        console.log('priorityList.indexOf(ext) :>> ', priorityList.indexOf(ext));
        console.log('priorityList.indexOf(current) :>> ', priorityList.indexOf(current));
        console.log('priorityList.indexOf(ext) > priorityList.indexOf(current) :>> ', priorityList.indexOf(ext) > priorityList.indexOf(current));
        if(priorityList.indexOf(ext) > priorityList.indexOf(current)){
            uniq.set(name, ext)
        }
    }

    return Array.from(uniq.entries()).reduce((p,c) => [...p, `${c[0]}${c[1]}`], [])

};

    // const uniq = fileobjs.reduce((acc, curr) => {
    //     const existingFile = acc.find(file => file.name === curr.name);
    //     if (!existingFile) {
    //         acc.push(curr);
    //     } else {
    //         const existingPriority = priorityList.indexOf(path.extname(existingFile.name).toLowerCase());
    //         const currentPriority = priorityList.indexOf(curr.ext.toLowerCase());
    //         if (currentPriority < existingPriority) {
    //             acc = acc.filter(file => file.name !== existingFile.name);
    //             acc.push(curr);
    //         }
    //     }
    //     return acc;
    // }, []);

    // const uniqueFiles = uniq.map(file => path.join(path.dirname(file), `${file.name}${file.ext}`));

    // return Promise.resolve({ inputFiles: uniqueFiles });
// };

const createConversionList = async (settings, files) => {

    // return new Promise((resolve, reject) => {
        let conversionList = [];
        let didPickAll = false;

        for (const inputFile of files) {
            for (const outputFormat of settings.outputFormats) {
                let outputFile = `${path.join(path.dirname(inputFile), path.basename(inputFile, path.extname(inputFile)))}.${outputFormat}`;
                if(fs.existsSync(outputFile)) {
                    if(didPickAll) {
                        if(didPickAll === 'r') outputFile = `${path.join(path.dirname(inputFile), `${path.basename(inputFile, path.extname(inputFile))} copy (1)`)}.${outputFormat}`;
                        if(didPickAll === 's') outputFile = 'skipped!';
                    }else {
                        const response = await getAnswer(`[O]verwrite, [R]ename or [S]kip ${outputFile}? : `)
                        if(/^r$/i.test(response.trim())) {
                            outputFile = `${path.join(path.dirname(inputFile), `${path.basename(inputFile, path.extname(inputFile))} copy (1)`)}.${outputFormat}`;
                        }
                        if(/^ra$/i.test(response.trim())) {
                            outputFile = `${path.join(path.dirname(inputFile), `${path.basename(inputFile, path.extname(inputFile))} copy (1)`)}.${outputFormat}`;
                            didPickAll = 'r';
                        }
                        if(/^s$/i.test(response.trim())) outputFile = 'skipped!';
                        if(/^sa$/i.test(response.trim())) {
                            outputFile = 'skipped!';
                            didPickAll = 's';
                        }
                    }
                }
                conversionList.push({
                    inputFile,
                    outputFile,
                    outputFormat
                });
                
            }
        }

        console.log('Pending conversion:', conversionList);
        
        conversionList = conversionList.filter(x => x.outputFile !== 'skipped!');


        const accept_answer = await getAnswer('This is the list of files to be converted. Accept? Type yes or no: ');
        if(/^no$/i.test(accept_answer)) throw new Error('Conversion cancelled');
        if(!/^yes$/i.test(accept_answer)) throw new Error('invalid input, please use "yes" or "no"')
        return conversionList
};

// const convertAudio = (settings, files) => {
//     console.info('settings', settings);
//     console.info('files', files);
//     // {
//     //     inputFile: '/home/acdavis/desktop/LostAges/audio/bgm/POL-no-way-out-short.wav',
//     //     outputFile: '/home/acdavis/desktop/LostAges/audio/bgm/POL-no-way-out-short.ogg',
//     //     outputFormat: 'ogg'
//     //   },
//     return files.map(file => { 
//         return new Promise((resolve, reject) => {
//             const {inputFile, outputFile, outputFormat} = file;

//             const ffmpegCommand = ffmpeg(inputFile)
//                 .audioCodec(outputFormat === 'ogg' ? 'libvorbis' : 'aac')
//                 .audioBitrate(settings.bitrate)
//                 .toFormat(outputFormat)
//                 .on('end', () => {
//                     console.log(`Converted ${inputFile} to ${outputFormat} with bitrate ${settings.bitrate}`);
//                     resolve(outputFile);
//                 })
//                 .on('error', (err) => reject(err))
//                 .save(outputFile);
//     })
// })
// };

const convertAudio = (settings, files) => {
    console.info('settings', settings);
    console.info('files', files);
  
    return files.map(file => {
      return new Promise((resolve, reject) => {
        const { inputFile, outputFile, outputFormat } = file;

        // const cmd = `${path.join(__dirname, 'ffmpeg.exe')} -i ${inputFile} -c:a ${outputFormat === 'ogg' ? 'libvorbis' : 'aac'} -b:a ${settings.bitrate.toString()} -y ${outputFile}`;

        // const conversion = spawn(cmd);

        // conversion.on('close', () => {
        //     console.log(`Converted ${inputFile} to ${outputFormat} with bitrate ${settings.bitrate}`);
        //     resolve(outputFile);
        //   });
    
        //   conversion.on('error', (err) => reject(err));
  
        const ffmpegCommand = spawn(path.join(__dirname, 'ffmpeg.exe'), [
          '-i',
          inputFile,
          '-c:a',
          outputFormat === 'ogg' ? 'libvorbis' : 'aac',
          '-b:a',
          `${settings.bitrate.toString()}k`,
          '-y',
          outputFile
        ], {shell: true});
  
        ffmpegCommand.on('close', () => {
          console.log(`Converted ${inputFile} to ${outputFormat} with bitrate ${settings.bitrate}`);
          resolve(outputFile);
        });
  
        ffmpegCommand.on('error', (err) => reject(err));
      });
    });
  };

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const getAnswer = async (question) => new Promise((res, rej) => rl.question(question, ans => res(ans)))

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
    .then((files) => Promise.all([...convertAudio(settings, files)]))
    .catch((error) => {
        handleError(error);
    })
    .finally(() => rl.close());

