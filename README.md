# EZ-Game-Audio-Conversion
Convert all your mp3's and wav's to ogg and or m4a in just a few clicks.

This is a command-line application that allows you to search for audio files in a specified directory and its subdirectories, then convert them to different output formats.

## Prerequisites

- Windows PC
- Node.js (version ?.?.? or higher)
- npm (version ?.?.? or higher)

## Installation

1. Clone or download the repository.
2. Install node and dependencies.
3. Download https://www.ffmpeg.org/download.html
4. Copy the 3 exe files from \bin to the root of this project

## Usage

1. node .\app.js\
2. Follow the prompts to provide the necessary information:

- Enter the full file path to start the search. This will search all subfolders!
- Enter the file extensions to look for. Leave blank for all (e.g., mp3 wav).
- Enter the output formats. Leave blank for all (e.g., ogg m4a). This will output to all the formats you input separately. 
- Enter the audio bitrate from 32 to 320. Leave blank for 192 (e.g., 128).

3. The application will search for matching files based on the provided criteria and display the list of files to be converted.
5. Duplicate file names with different extensions will be deleted from the list in favor of the best format.

6. Follow more prompts to decided what to do for each file. Adding "a" to your selection will make it for all subsequent files.
   - O: Overwrite any file with the same name.
   - R: Rename will add copy to the name
   - S: Skip will not convert this file.
   
7. Review the list of files to be converted and confirm to proceed by typing "yes" or "no" when prompted.

8. If you choose to proceed, the application will convert the audio files to the specified output formats and save them in the same directory as the input files.
   Logs will confirm each file has been successfully converted.

## License

This project is licensed under the [GNU AFFERO GENERAL PUBLIC LICENSE](https://www.gnu.org/licenses/agpl-3.0.txt).

## More info:

https://rpgmaker.net/articles/2633/
RMMV uses m4a as well but not really needed in 2023

Features	        MP3	Ogg	WAV	MIDI
Loop OK	            NO	YES	YES	YES
Loop Inside (Tags)	NO	YES	NO	YES
File Size Optimize.	YES	YES	NO	OMG YES
Realistic Sound	    YES	YES	YES	NO
RMMV Compatible	    NO	YES	NO	NO
RMVX/Ace Compatible	YES	YES	YES	YES
RMXP Compatible	    YES	YES	YES	YES
RM2003 Compatible	YES	NO	YES	YES

M4A files are compressed using the 'AAC' lossy

