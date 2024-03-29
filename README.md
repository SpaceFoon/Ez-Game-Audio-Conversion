# EZ Game Audio Conversion

**Effortless Unattended Batch Audio Conversion Tool.**

## Introduction

EZ-Game-Audio-Conversion streamlines the process of batch audio file conversion. Tailored specifically for game developers, this tool ensures top-notch audio quality and small file sizes without the need for extensive knowledge. With almost no setup and multi-threaded conversion, it's the easiest, fastest, and most reliable solution available. Plus, now with support for loop tags!

## Features

- **User-Friendly Interface:** Designed with simplicity as the main goal, eliminating any learning curve.
- **Unattended Batch Jobs**: With recursive file searching and unattended conflict resolution, just set it and forget it.
- **Multi-threading:** No job too big or small when your CPU is fully utilized.
- **Automatic Bitrate and Codec Selection:** Automatically selects best codec and Variable Bitrate (VBR) at 128kbs or near equivalent. Balanced between great sound quality and small file size.
- **Comprehensive Format Support:** Converts between FLAC, WAV, MP3, OGG, and M4A, formats. More to come.
- **Privacy and Reliability:** Operates offline, ensuring data privacy and reliability.
- **High-Quality Output:** Employs FFMPEG for superior sound quality, codec support and speed.
- **Intelligent File Handling:** Automatically resolves duplicate file names and selects the best input file.
- **Meta Data Support:** Will transfer basic meta data like title and artist. Works with all formats.
- **Loop Tag Support:** All loop meta data will be transferred to new Ogg or FLAC files. When changing sample rate, loop timings will be adjusted automatically.

## Installation

1. **Download** Zip "EZ-Game-Audio.zip"
2. **Extract**  folder "EZ-Game-Audio-Converter"
3. **Run** file "EZ-Game-Audio.exe"

## Prerequisites

- Windows PC
- Windows Terminal for enhanced visual experience.

## Usage

1. **Setup:** Follow the setup prompts. It's recommended to copy and paste file path. Right-click to paste.

2. **File Selection:** The application will search for matching files based on the provided criteria and display the list of files to be converted.

3. **Duplicate Handling:** Duplicate file names with different extensions will be automatically resolved, retaining the best or lossless format.

4. **Conflict Resolution:** Resolve conflicts for conflicting output files:
   - `O`: Overwrite file with the same name. File will not overwrite itself but will skip instead.
   - `R`: Rename the file.
   - `S`: Skip the conversion for this file.
   - Adding `a` to your selection will apply it to all subsequent files.

5. **Confirmation:** Review the list of files to be converted and confirm by typing "yes" or "no" when prompted.

6. **Conversion:** Monitor progress and any errors during the conversion process. Upon completion, logs will be available at the specified file path. Any errors will be logged separately.

## Source

Prefer a hands-on approach over trusting random files from the internet? No worries. Build EZ-Game-Audio-Conversion from source for peace of mind.

Install NodeJs and the Pkg Node module then execute `npm run build`. Even simpler, use `npm run start`. Just remember to have `ffmpeg.exe` and `ffprobe.exe` located alongside wherever you run the application from.

To change things like bitrate and codec, look in `converterWorker.js`. 
<https://github.com/SpaceFoon/Ez-Game-Audio-Conversion>

## License

This project is licensed under the [GNU Affero General Public License (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.txt).

## Audio File Type Compatibility

### RPG Maker

| Features |  MP3 |  OGG | WAV | M4A[^1] | MIDI |
|--|--|--|--|--|--|
| Loop OK | NO | YES | YES | YES | YES |
| Loop Inside (Tags) | NO | YES | NO | YES | YES |
| File Size Optimize | YES | YES | NO | YES[^2] | OMG YES |
| Realistic Sound | YES | YES | YES | YES | NO |
| RMVX/Ace Compatible| YES | YES | YES | NO | YES |
| RMXP Compatible | YES | YES | YES | NO | YES |
| RM2003 Compatible | YES | NO | YES | NO | YES |
| RMMV Compatible | NO | YES | NO | YES | NO |
| RMMZ Compatible | NO | YES | NO | NO | NO |

RPG Maker MV can support Ogg Opus but the editor preview won't work.
[^1]: Not needed in 2024?
[^2]: M4A can be lossless but isn't when converted by this software.

- Source: [RPGMaker.net](https://rpgmaker.net/articles/2633/)

#### Unity

- **Supported Formats:** `MPEG(1/2/3), OGG, .aiff, .mod, .it, .s3m, .xm`

Source: [Unity Documentation](https://docs.unity3d.com/352/Documentation/Manual/AudioFiles.html)

#### Godot

- **Supported Formats:** `WAV, MP3, OGG`

Source: [Godot Documentation](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_audio_samples.html#supported-audio-formats)

#### Unreal Engine

- **Supported Format:** `WAV`
- Unreal Engine imports uncompressed, little endian, 16-bit Wave (WAV) files at any sample rate which this software exports to.

Source: [Unreal Engine Documentation](https://docs.unrealengine.com/4.27/en-US/WorkingWithAudio/ImportingAudio/)

#### Ren'Py

- **Supported Formats:** `Ogg Opus, Ogg Vorbis, MP3, MP2, FLAC, WAV (uncompressed 16-bit signed PCM only)`

Source: [Ren'Py Documentation](https://www.renpy.org/doc/html/audio.html)

#### Game Maker Studio

- **Supported Formats:** `OGG, MP3 and WAV`
Source: [Gamemaker.io](https://manual.gamemaker.io/monthly/en/GameMaker_Language/GML_Reference/Asset_Management/Audio/Audio.htm)

### Additional Notes

- M4A files are compressed using the 'AAC' lossy codec. For lossless quality, use WAV or FLAC formats.
- WAV uses the pcm_s16le codec, while OGG uses the newer Opus codec.
- Lossy formats utilize Variable Bit Rate (VBR) for increased compression.

#### Additional Comparison

For a detailed comparison of audio formats for games, refer to [this article](https://dev.to/tenry/comparison-of-audio-formats-for-games-jak).

https://wiki.xiph.org/Opus_Recommended_Settings



### Other Attributes

- [Icon Source](https://icon-icons.com/icon/audio-x-generic/36263)
