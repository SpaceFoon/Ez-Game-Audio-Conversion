const fs = require('fs');
const readline = require('readline');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function convertAudio(inputPath, outputPath, format) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioCodec(format === 'ogg' ? 'libvorbis' : 'aac')
            .toFormat(format)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
}

function findFiles(folderPath, fileExtensions) {
    return new Promise((resolve, reject) => {
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                reject(err);
                return;
            }

            const lowerCaseExtensions = Array.isArray(fileExtensions)
                ? fileExtensions.map((ext) => ext.toLowerCase())
                : [fileExtensions.toLowerCase()];

            const filteredFiles = files.filter((file) => {
                const lowerCaseFile = file.toLowerCase();
                return lowerCaseExtensions.some((ext) => lowerCaseFile.endsWith(ext));
            });

            resolve(filteredFiles);
        });
    });
}

async function convertAllFiles(folderPath, fileExtensions, formats) {
    try {
        const extensionsArray = fileExtensions.split(' ').map(ext => `.${ext}`);
        const files = await findFiles(folderPath, extensionsArray);

        if (files.length === 0) {
            console.log(`No files with extensions ${extensionsArray.join(', ')} found in the specified folder:`, folderPath);
            rl.close();
            return;
        }

        console.log(`Files to be converted (${extensionsArray.join(', ')}):`);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const fileName = path.basename(file, path.extname(file));

            for (const format of formats) {
                const outputFilePath = path.join(folderPath, `${fileName}.${format}`);
                // Check if the corresponding format file already exists
                if (!fs.existsSync(outputFilePath)) {
                    console.log(`${file} to ${format}`);
                }
            }
        }

        rl.question('Do you want to perform the conversion? (yes/no): ', async (answer) => {
            if (answer.toLowerCase() === 'yes') {
                for (const file of files) {
                    const filePath = path.join(folderPath, file);
                    const fileName = path.basename(file, path.extname(file));

                    for (const format of formats) {
                        const outputFilePath = path.join(folderPath, `${fileName}.${format}`);
                        // Check if the corresponding format file already exists
                        if (!fs.existsSync(outputFilePath)) {
                            console.log(`Converting ${file} to ${format}...`);
                            await convertAudio(filePath, outputFilePath, format);
                        }
                    }
                }
            }

            rl.close();
        });
    } catch (error) {
        console.error('Error:', error);
        rl.close();
    }
}
// Ask the user for the folder path, file extensions, and desired formats
rl.question('Enter the folder path: ', (folderPath) => {
    rl.question('Enter the file extensions (e.g., mp3 wav): ', (fileExtensions) => {
        rl.question('Enter the desired formats (e.g., ogg m4a): ', (formatString) => {
            const lowerCaseFormatString = formatString.toLowerCase();
            const formats = lowerCaseFormatString.includes('ogg') && lowerCaseFormatString.includes('m4a')
                ? ['ogg', 'm4a']
                : formatString.split(' ');
            convertAllFiles(folderPath, fileExtensions, formats);
        });
    });
});