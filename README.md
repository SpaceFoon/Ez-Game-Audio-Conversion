# Ez-Game-Audio-Conversion
Convert all your mp3's and wav's to ogg in just a few clicks.

This is a command-line application that allows you to search for audio files in a specified directory and its subdirectories, and convert them to different output formats.

## Prerequisites

- Node.js (version ?.?.? or higher)
- npm (version ?.?.? or higher)
- a terminal 
## Installation

1. Clone or download the repository.
2. Install node and dependencies: npm install fluent-ffmpeg fs readline path
3. Download https://www.ffmpeg.org/download.html
4. Copy the 3 exe files from \bin to the root of this project

## Usage

1. node .\app.js\
2. Follow the prompts to provide the necessary information:

- Enter the full file path to start the search. This will search all subfolders!
- Enter the file extensions to look for. Leave blank for all (e.g., mp3 wav).
- Enter the output formats. Leave blank for all (e.g., ogg m4a). This will output to all the formats you input separately. 
- Enter the audio bitrate from 64 to 320. Leave blank for 192 (e.g., 128).

3. The application will search for matching files based on the provided criteria and display the list of files to be converted.

4. Confirm whether to proceed with the conversion by typing "yes" or "no" when prompted.

5. If you choose to proceed, the application will convert the audio files to the specified output formats and save them in the same directory as the input files.
   Logs will confirm each file has been successfully converted.

## License

This project is licensed under the [GNU AFFERO GENERAL PUBLIC LICENSE](https://www.gnu.org/licenses/agpl-3.0.txt).
