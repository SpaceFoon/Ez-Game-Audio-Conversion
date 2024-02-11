# EZ-Game-Audio-Conversion

Simple batch audio conversion.

Multi-threaded and portable.

Just extract the zip and run the app.

Search for audio files in a specified directory and its subdirectories, then convert them to different output formats.  

I made this for myself and other game devs that have run into the problem of of having hundreds and sometimes thousands of audio files, all in different formats, that needed to be converted to a few other formats depending on the build target of the game. Not all game devs are programmers, audio experts or even "power users". 

There should be no learning curve with this software. This softwares goal is to be as simple and easy as possible. To just work.

Don't use this for audio meant to be used in a video editor! Video editors don't like the variable bit rate used.

There is https://ffmpeg-batch.sourceforge.io/ that does this but it's confusing and slower but does much more if you need it. In my testing it hung and crashed a bit.


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

## Planned

- Add output location option.
- An Advanced option set for setting bit rate. Not priory as a higher bitrate won't be noticeable 99.9% of the time.
- Sister apps that do the same thing for pictures and videos!

## Prerequisites

- Windows PC
- Windows Terminal installed for better looks.

## Installation

None.
Just unzip the folder and run the exe.

If you want to build from source, use the Pkg Node module and npm run build.

## Usage

1. Follow the setup prompts. Recommend to copy and paste file path. Right click to paste.

2. The application will search for matching files based on the provided criteria and display the list of files to be converted.

3. Duplicate file names with different extensions will be deleted from the list in favor of the best format.

4. Follow prompt if conflicting outfiles. Adding "a" to your selection will make it for all subsequent files.
   - O: Overwrite file with the same name. Will not overwrite itself.
   - R: Rename will add copy to the name
   - S: Skip will not convert this file.
   
5. Review the list of files to be converted and confirm to proceed by typing "yes" or "no" when prompted.

6. While converting you can watch the progress and any errors. When all tasks are complete there will be logs in the file path you specified earlier. If there are any errors they will be in a different log.

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
