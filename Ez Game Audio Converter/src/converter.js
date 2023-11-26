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

// const ffmpeg = require('fluent-ffmpeg');
// // const ffmpeg = require('ffmpeg');
// const fs = require('fs');
// const readline = require('readline');
// const path = require('path');
// const { readdirSync, statSync } = require('fs');
// const { join, basename, extname } = require('path');
// const { spawn } = require('child_process');
// const pathToFfmpeg = require('.')

import { readDir } from '@tauri-apps/api/fs';
import { basename, join, extname, dirname } from '@tauri-apps/api/path';
import { Command } from '@tauri-apps/api/shell'

export const searchFiles = async (filePath, inputFormats) => {

  try {
    const fileExtensions = inputFormats?.length ? inputFormats : ['mp3', 'wav', 'flac'];
    const searchPath = filePath;

    console.log('Search Path:', searchPath);
    console.log('File Extensions:', fileExtensions);

    const allFiles = [];

    const walk = arr => {
      for(const {name, path, children} of arr) {
        if(!children && fileExtensions.includes(name.split('.').pop().toLowerCase()))
          allFiles.push(path);
        if( children && children.length > 0 ) walk(children);
      }
    }

    const entries = await readDir(filePath, { recursive: true });
    for(const entry of entries) {
      const { name, path, children } = entry;
      if(!children && fileExtensions.includes(name.split('.').pop().toLowerCase()))
        allFiles.push(path);

      if( children && children.length > 0 ) walk(children);
    }

    console.log('allFiles', allFiles);

    const deduped = await deleteDuplicateFiles(allFiles);

    console.log('deduped', deduped);



    return allFiles;
  } catch (error) {
    console.error(error)
  }
};

const deleteDuplicateFiles = async (files) => {
    const priorityList = ['.mp3', '.wav', 'flac'];
    console.log('files', files);

    const fileobjs = [];

    for (const file of files) {
      const dname = await dirname(file);
      const ename = await extname(file);
      const bname = (await basename(file, ename)).replace(/[.]$/, '');
      const begin = await join(dname, bname)
      fileobjs.push([begin, ename]);
    }


    // const fileobjs = files.map(file => [join(dirname(file), basename(file, extname(file))), extname(file)]);
    console.log('fileobjs', fileobjs)

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

    return Array.from(uniq.entries()).reduce((p,c) => [...p, `${c[0]}.${c[1]}`], [])

};

export const createConversionList = async (outputTypes, files) => {
    const conversionList = [];
    let response = null;
    const otypes = outputTypes.length ? outputTypes : ['ogg', 'm4a']
    for (const inputFile of files) {
        for (const outputFormat of otypes) {
            let outputFile = `${await join(await dirname(inputFile), await basename(inputFile, await extname(inputFile)))}${outputFormat}`;
            //console.log(`${inputFile}`)
            //console.log(`${outputFile}`)
            let outputFileCopy = `${await join(await dirname(inputFile), `${(await basename(inputFile, await extname(inputFile))).replace(/[.]$/, '')} copy (1)`)}.${outputFormat}`;
            conversionList.push({
              inputFile,
              outputFile,
              outputFormat,
              outputFileCopy
          });
            // if(outputFile) {
            //     const responseActions = {
            //         o: () => {return response = null;},
            //         oa: () => {/* Nothing to do as default is overwrite */},
            //         r: () => { outputFile = outputFileCopy; return response = null;},//copies fail to convert
            //         ra: () => { outputFile = outputFileCopy;},
            //         s: () => { outputFile = 'skipped!'; return response = null},
            //         sa: () => { outputFile = 'skipped!'; }
            //     }
            //     switch (response) {
            //         case 'ra':
            //             responseActions['ra']();
            //             break;
            //         case 'sa':
            //             responseActions['sa']();
            //             break;
            //         case 'oa':
            //             console.log('OVERWRITE FILE', outputFile);
            //             break;
            //         default:
            //             console.log('response: ',response)
            //             while (true){
            //             if (!response){
            //                 response = await getAnswer(`[O]verwrite, [R]ename or [S]kip. Add 'a' for all (e.g., oa, ra, sa)'\n'${outputFile}? : `);
            //                 response = response.trim().toLowerCase();
            //                 if (responseActions[response]) {
            //                     responseActions[response]();
            //                     break;
            //                 } else {
            //                     response = null;
            //                     console.log('You did not enter a valid selection, try again.');
            //                 }
            //             }
            //         }
            //     }
            //     conversionList.push({
            //         inputFile,
            //         outputFile,
            //         outputFormat,
            //     });
            // }else{console.error("file does not exist")}
        }
    }

    console.log('Pending conversion:', conversionList);
    // const accept_answer = await getAnswer('This is the list of files to be converted. Accept? Type yes or no: ');
    // if(/^no$/i.test(accept_answer)) throw new Error('Conversion cancelled');
    // if(!/^yes$/i.test(accept_answer)) throw new Error('invalid input, please use "yes" or "no"');
    // return conversionList.filter(x => x.outputFile !== 'skipped!');
    return conversionList;
};

// const checkFileCodec = (files) => {

// array.forEach(files => {
//     ffmpeg.ffprobe(files[i], (err, metadata) => {
//       if (err) {
//         console.error('Error while probing:', err);
//       } else {
//         // Access the codec information from the metadata object
//         const audioCodec = metadata.streams.find(stream => stream.codec_type === 'audio').codec_name;
//         const videoCodec = metadata.streams.find(stream => stream.codec_type === 'video').codec_name;
    
//         console.log('Audio codec:', audioCodec);
//         console.log('Video codec:', videoCodec);
//       }
//     });
//     })
// };

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

export const convertAudio2 = async (settings, files) => {
    const maxRetries = 3;
    const failedFiles = [];

    const convertWithRetry = async (inputFile, outputFile, outputFormat) => {
        let retryCount = 0;
        let success = false;

        while (!success && retryCount < maxRetries) {
            try {
                await new Promise((resolve, reject) => {
                    const ffmpegCommand = new Command('ffmpeg.exe', [
                        '-i',
                        `"${inputFile}"`,
                        '-c:a',
                        outputFormat === 'ogg' ? 'libopus' : 'aac',
                        '-b:a',
                        `${settings.bitrate.toString()}k`,
                        '-y',
                        `"${outputFile}"`
                    ]);

                    ffmpegCommand.on('close', (data) => {
                        if (data.code === 0) {
                            console.log(`Conversion successful for ${getFilename(inputFile)} to ${getFilename(outputFile)}`);
                            success = true;
                            resolve();
                        } else {
                            console.error(`Conversion failed for ${getFilename(inputFile)} to ${getFilename(outputFile)}. Exit code: ${data.code}`);
                            retryCount++;
                            console.log(`Retrying... (Attempt ${retryCount}/${maxRetries})`);
                            reject(new Error(`Conversion failed for ${inputFile}. Exit code: ${data.code}`));
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


