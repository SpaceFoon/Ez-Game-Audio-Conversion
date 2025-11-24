import { existsSync, mkdirSync, statSync } from 'fs';
import chalk from 'chalk';
import { checkDiskSpace } from './utils.js';
import readline from 'readline/promises';
import path from 'path';
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const inputTypes = ['flac', 'aiff', 'wav', 'mp3', 'm4a', 'ogg'];
const outputTypes = ['flac', 'aiff', 'wav', 'mp3', 'm4a', 'ogg'];
//Entire input loop to get settings before converting.
const getUserInput = async (settings) => {
    // Check if we have a command-line argument (either file or folder)
    const argPath = process.argv[2];
    if (argPath && process.argv.length > 2 && existsSync(argPath)) {
        const pathStats = statSync(argPath);
        // Handle single file mode
        if (pathStats.isFile()) {
            const filePath = argPath;
            const fileExt = path.extname(filePath).toLowerCase().substring(1); // Remove the dot
            if (!inputTypes.includes(fileExt)) {
                console.error(chalk.red.bold(`\n❌ Unsupported file type: ${fileExt}`));
                console.error(chalk.red(`Supported file types: ${inputTypes.join(', ')}`));
                process.exit(1);
            }
            settings.inputFilePath = path.dirname(filePath);
            settings.singleFileMode = true;
            settings.singleFilePath = filePath || '';
            settings.inputFormats = [fileExt];
            console.log(chalk.green.italic(`\n📝 Processing single file: ${filePath} ✅`));
            console.log(chalk.green.italic(`File extension: ${fileExt}`));
        }
        // Handle folder from context menu
        else if (pathStats.isDirectory()) {
            settings.inputFilePath = argPath;
            settings.singleFileMode = false;
            console.log(chalk.green.italic(`\n📝 Input Folder: ${settings.inputFilePath} ✅`));
        }
        // Ask for the output folder
        while (true) {
            let outputFilePath = await rl.question(chalk.blue.bold('\n✏️  Enter the output folder for converted file(s). 🚨 Leave blank for same folder as input 📂:'));
            if (outputFilePath === '')
                outputFilePath = settings.inputFilePath;
            if (!existsSync(outputFilePath)) {
                console.warn('\n⚠️ File Path does not exist! 👨‍🏭 Creating folder... 🚧');
                try {
                    mkdirSync(outputFilePath, { recursive: true });
                }
                catch {
                    console.error('Failed to make folder at:', outputFilePath);
                    continue;
                }
            }
            settings.outputFilePath = outputFilePath;
            console.log(chalk.green.italic(`\n📝 Output Folder: ${outputFilePath} ✅`));
            checkDiskSpace(outputFilePath);
            break;
        }
        // If it's a folder from context menu, ask for input formats
        if (!settings.singleFileMode) {
            // Ask for input formats
            while (true) {
                const inputFormatString = await rl.question(chalk.blue.bold('\n✏️  Enter the file extensions to look for. Leave blank for all 🚨 (e.g., ogg, mp3, m4a, wav, aiff, flac): '));
                settings.inputFormats = inputFormatString
                    ? inputFormatString
                        .toLowerCase()
                        .split(/\s*,\s*|\s+/)
                        .map((format) => format.trim())
                    : [...inputTypes];
                if (settings.inputFormats.length === 0 ||
                    !settings.inputFormats.every((format) => inputTypes.includes(format))) {
                    console.warn('\n🛑🙊Invalid input format🙈🛑\n⚠️Only ogg, mp3, m4a, wav, aiff and flac are allowed');
                    continue;
                }
                console.log(chalk.green.italic(`\n📝 Input formats: ${settings.inputFormats
                    .map((el) => el + '✅ ')
                    .join('')}`));
                break;
            }
        }
        // Ask for output formats
        while (true) {
            const outputFormatString = await rl.question(chalk.blue.bold('\n✏️  Enter the output formats. Leave blank for all 🚨 (e.g., ogg, mp3, m4a, wav, aiff, flac): '));
            settings.outputFormats = outputFormatString
                ? outputFormatString
                    .toLowerCase()
                    .split(/\s*,\s*|\s+/)
                    .map((format) => format.trim())
                : [...outputTypes];
            if (settings.outputFormats.length === 0 ||
                !settings.outputFormats.every((format) => outputTypes.includes(format))) {
                console.warn('\n🛑🙊Invalid output format🙈🛑\n⚠️Only ogg, mp3, m4a, wav, aiff and flac are allowed!');
                continue;
            }
            console.log(chalk.green.italic(`\n📝 Output formats: ${settings.outputFormats
                .map((el) => el + ' ✅')
                .join(' ')}`));
            break;
        }
        return settings;
    }
    // No command-line arguments - Normal interactive mode
    while (true) {
        let inputFilePath = await rl.question(chalk.blue.bold('\n 📁 Choose the folder to search for files to convert. ', '\n 🔍 This will recursively search, ie: all subfolders ', '\n 🐭 Right-click to paste. ', '\n ✏️  Input Folder Path: '));
        if (!existsSync(inputFilePath)) {
            console.warn('\n⚠️  File Path does not exist! 🤣😊😂');
            continue;
        }
        settings.inputFilePath = inputFilePath;
        settings.singleFileMode = false;
        console.log(chalk.green.italic(`\n📝 Input Folder: ${settings.inputFilePath} ✅`));
        break;
    }
    // Ask for the output folder
    while (true) {
        let outputFilePath = await rl.question(chalk.blue.bold('\n✏️  Enter the output folder for converted file(s). 🚨 Leave blank for same folder as input files 📂:'));
        if (outputFilePath === '')
            outputFilePath = settings.inputFilePath;
        if (!existsSync(outputFilePath)) {
            console.warn('\n⚠️ File Path does not exist! 👨‍🏭 Creating folder... 🚧');
            try {
                mkdirSync(outputFilePath, { recursive: true });
            }
            catch {
                console.error('Failed to make folder at:', outputFilePath);
                continue;
            }
        }
        settings.outputFilePath = outputFilePath;
        console.log(chalk.green.italic(`\n📝 Output Folder: ${outputFilePath} ✅`));
        checkDiskSpace(outputFilePath);
        break;
    }
    // Ask for input formats
    while (true) {
        const inputFormatString = await rl.question(chalk.blue.bold('\n✏️  Enter the file extensions to look for. Leave blank for all 🚨 (e.g., ogg, mp3, m4a, wav, aiff, flac): '));
        settings.inputFormats = inputFormatString
            ? inputFormatString
                .toLowerCase()
                .split(/\s*,\s*|\s+/)
                .map((format) => format.trim())
            : [...inputTypes];
        if (settings.inputFormats.length === 0 ||
            !settings.inputFormats.every((format) => inputTypes.includes(format))) {
            console.warn('\n🛑🙊Invalid input format🙈🛑\n⚠️Only ogg, mp3, m4a, wav, aiff and flac are allowed');
            continue;
        }
        console.log(chalk.green.italic(`\n📝 Input formats: ${settings.inputFormats
            .map((el) => el + '✅ ')
            .join('')}`));
        break;
    }
    // Ask for output formats
    while (true) {
        const outputFormatString = await rl.question(chalk.blue.bold('\n✏️  Enter the output formats. Leave blank for all 🚨 (e.g., ogg, mp3, m4a, wav, aiff, flac): '));
        settings.outputFormats = outputFormatString
            ? outputFormatString
                .toLowerCase()
                .split(/\s*,\s*|\s+/)
                .map((format) => format.trim())
                .filter((format) => outputTypes.includes(format))
            : [...outputTypes];
        if (settings.outputFormats.length === 0 ||
            !settings.outputFormats.every((format) => outputTypes.includes(format))) {
            console.warn('\n🛑🙊Invalid output format🙈🛑\n⚠️Only ogg, mp3, m4a, wav, aiff and flac are allowed!');
            continue;
        }
        console.log(chalk.green.italic(`\n📝 Output formats: ${settings.outputFormats
            .map((el) => el + ' ✅')
            .join(' ')}`));
        break;
    }
    return settings;
};
export default getUserInput;
//# sourceMappingURL=getUserInput.js.map