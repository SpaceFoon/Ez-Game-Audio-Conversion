# EZ-Game-Audio-Conversion

Convert ALL your audio files to other formats in just a few clicks.  

This is a command-line application that allows you to search for audio files in a specified directory and its subdirectories, then convert them to different output formats.  

I made this for myself and other game devs that have run into the problem of of having hundrededs and sometimes thousands of audio files, all in different formats, that needed to be converted to a few other formats depending on the build target of the game. Not all game devs are programmers, audio experts or even "power users".  

Don't use this for audio meant to be used in a video editor!  

There is https://ffmpeg-batch.sourceforge.io/ that does this but it's confusing and slower. In my testing it hungs and crashes and has weird dialogs that don't ask a question but require yes or no to continue.  

My softwares goal is to be as simple and easy as possible and to just work.  

## What

- For the conversion of large numbers of audio files that may be buried in folders.
- For the simplest interface with unattended batch jobs.
- Supports conversion to and from FLAC, WAV, MP3, OGG, M4A and MIDI as an input only.

## Why

- Searches recursively in location to find all files that fit your criteria.
- Unattended batches, click it and forget it.
- Privacy and reliability, internet is never used!
- Uses FFMPEG for the highest quality sound with the best codecs.
- Automatically selects codec and bitrate for each file.

## Additional Info

- If duplicate file names with different extensions, automatically selects the file with the best format. ie FLAC over MP3.
- Automatically selects bitrate about 192kbs or lower for the output. This is a balance between great sound quality and small file size.
- Uses Variable Bitrate (VBR) when possible for smaller file size.
- M4A files are compressed using the 'AAC' lossy. Use WAV or FLAC for lossless.
- FLAC and WAV are not compressed as outputs. This means no quality is lost.

## Planned

- Add output location option.
- An Advanced option set for setting bit rate. Not priory as a higher bitrate won't be noticeable 99.9% of the time.
- Sister apps that do the same thing for pictures and videos!

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

Features	            MP3	Ogg	WAV	MIDI  
Loop OK	            NO	   YES	YES	YES  
Loop Inside (Tags)	NO	   YES	NO	   YES  
File Size Optimize.	YES	YES	NO	   OMG YES  
Realistic Sound	   YES	YES	YES	NO  
RMMV Compatible	   NO	   YES	NO	   NO  
RMVX/Ace Compatible	YES	YES	YES	YES  
RMXP Compatible	   YES	YES	YES	YES  
RM2003 Compatible	   YES	NO	   YES	YES  

M4A files are compressed using the 'AAC' lossy.
Use WAV for Flac for lossless.


Icon from https://icon-icons.com/download/16123/ICO/128/
or here https://icon-icons.com/icon/audio-card/103432