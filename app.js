/*
EZ GAME AUDIO CONVERSION



https://rpgmaker.net/articles/2633/
RMMV uses m4a as well but not really needed

Features	        MP3	Ogg	WAV	MIDI
Loop OK	NO	        YES	YES	YES
Loop Inside (Tags)	NO	YES	NO	YES
File Size Optimiz.	YES	YES	NO	OMG YES
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
//const path = require('path');
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

const createConversionList = async (settings, files) => {

    // return new Promise((resolve, reject) => {
        const conversionList = [];
        let response = null;
        for (const inputFile of files) {
            for (const outputFormat of settings.outputFormats) {
                let outputFile = `${path.join(path.dirname(inputFile), path.basename(inputFile, path.extname(inputFile)))}.${outputFormat}`;
                let outputFileCopy = `${path.join(path.dirname(inputFile), `${path.basename(inputFile, path.extname(inputFile))} copy (1)`)}.${outputFormat}`;
                if(fs.existsSync(outputFile)) {
                        switch (response) {
                            case 'ra':
                                outputFile = `${path.join(path.dirname(inputFile), `${path.basename(inputFile, path.extname(inputFile))} copy (1)`)}.${outputFormat}`;
                                break;
                            case 'sa':
                                outputFile = 'skipped!';
                                break;
                            case 'oa':
                                console.log('OVERWRITE FILE', outputFile)
                                break;
                            default:
                                const responseActions = {
                                    o: () => {response = null;},
                                    oa: () => {/* Nothing to do as default is overwrite */},
                                    r: () => { outputFile = outputFileCopy; response = null;},
                                    ra: () => { outputFile = outputFileCopy;},
                                    s: () => { outputFile = 'skipped!'; response = null},
                                    sa: () => { outputFile = 'skipped!'; }
                                }
                                while (response == null){
                                response = await getAnswer(`[O]verwrite, [R]ename or [S]kip. Add 'a' for all (ie Oa, Ra, Sa)'\n'${outputFile}? : `).trim().toLowerCase();
                                if (responseActions[response]) {
                                    responseActions[response]();
                                    }else{
                                        console.log('You did not enter a valid selection, try again.')
                                    }
                                }
                                break;
                        }
                conversionList.push({
                    inputFile,
                    outputFile,
                    outputFormat
                });
                
            }
        }
    }
        console.log('Pending conversion:', conversionList);
        


        const accept_answer = await getAnswer('This is the list of files to be converted. Accept? Type yes or no: ');
        if(/^no$/i.test(accept_answer)) throw new Error('Conversion cancelled');
        if(!/^yes$/i.test(accept_answer)) throw new Error('invalid input, please use "yes" or "no"')
        return conversionList.filter(x => x.outputFile !== 'skipped!');
};

const checkFileCodec = (files) => {
    // Replace 'inputFile.mp4' with the path to your multimedia file

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

// const convertAudio = (settings, files) => {
//     console.info('settings', settings);
//     console.info('files', files);
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


const convertAudio2 = async (settings, files) => {
    for (const{inputFile, outputFile, outputFormat } of files) {
        try {
            
            const wtf = await new Promise((resolve, reject) => {
                
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
          
                ffmpegCommand.on('close', (code) => {
                    if (code === 0) {
                      console.log(`Conversion successful for ${inputFile}`);
                      resolve(outputFile);
                    } else {
                      console.error(`Conversion failed for ${inputFile}. Exit code: ${code}`);
                      reject(new Error(`Conversion failed for111 ${inputFile}. Exit code: ${code}`));
                    }
                  });
          
                ffmpegCommand.on('exit', (code) => resolve(code));
                ffmpegCommand.on('error', (err) => reject(err));
              });
              console.log('wtf :>> ', wtf);
        } catch (error) {
            console.error('wtf error',error);
        }
    }
}

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

UserInputInitSettings()
    // find all files in all folders
    .then((settings) => searchFiles(settings))
    //delete files from the list that have the same name but different file extensions.
    //save the file that has the best format. Flac, wav, m4a, mp3
    .then((files) => deleteDuplicateFiles(files))
    //go through lis of input files and make output list.
    //there can be mutiple outputs and user input is needed here for output files
    // that already exist.
    .then((files) => createConversionList(settings, files))
    //This is needed to decided what codec to use for the conversion.
    //Had problems with output
    .then((files) => checkFileCodec(files))
    // this is used to convert audio to m4a
    .then(async (files) => await convertAudio2(settings, files))
    // this is used to convert audio to ogg
    .then(async (files) => convertAudio(files))
    // .then(async (files) => await Promise.all([...convertAudio(settings, files)]))
    .catch((error) => {
        handleError(error);
    })
    .finally(() => rl.close());

