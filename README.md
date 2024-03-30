# EZ Game Audio Conversion

**Effortless Unattended Batch Audio Conversion Tool.**

## Introduction

EZ-Game-Audio-Conversion streamlines the process of batch audio file conversion. Tailored specifically for game developers, this tool ensures great audio quality and small file sizes without the need for extensive knowledge. With almost no setup and multi-threaded conversion, it's the easiest, fastest, and most reliable solution available. Plus, now with support for loop tags!

## Features

- **User-Friendly Interface:** Designed with simplicity as the main goal, eliminating any learning curve.
- **Unattended Batch Jobs**: With recursive file searching and unattended conflict resolution, just set it and forget it.
- **Multi-threading:** No job too big or small when your CPU is fully utilized.
- **Automatic Bitrate and Codec Selection:** Automatically selects best codec and Variable Bitrate (VBR) at 128kbs or near equivalent. Balanced between great sound quality and small file size.
- **Comprehensive Format Support:** Converts between FLAC, WAV, MP3, OGG, and M4A, formats. More to come.
- **Privacy and Reliability:** Operates offline, ensuring data privacy and reliability.
- **High-Quality Output:** Employs FFMPEG for superior sound quality, codec support and speed.
- **Intelligent File Handling:** Automatically resolves duplicate file names and selects the best input file.
- **Meta Data Support:** Will transfer basic meta data like title. Works with all formats.
- **Loop Tag Support:** All loop meta data will be transferred to new Ogg or FLAC files. When changing sample rate, loop timings will be adjusted automatically. Cannot write loop tags TO M4A, only FROM.

## Installation

1. **Download** Zip "EZ-Game-Audio.zip"
2. **Extract**  folder "EZ-Game-Audio-Converter"
3. **Run** file "EZ-Game-Audio.exe"

## Prerequisites

- Windows PC
- Windows Terminal from the Windows Store for enhanced visual experience.

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

Prefer a hands-on approach over trusting random files from the internet? Here's how:

1. Clone the repository or download.

2. In the project folder, run `npm i` then `npm run build` to build the executable.
 OR
2. Or run `npm i` then `npm run start` to run from your terminal.

3. Remember to have `ffmpeg.exe` and `ffprobe.exe` located alongside wherever you run the application from.
[FFMPEG Essentials Build Download](https://www.gyan.dev/ffmpeg/builds/#release-builds)

To change things like bitrate and codec, look in `converterWorker.js`. 
[On Github](https://github.com/SpaceFoon/Ez-Game-Audio-Conversion)

### Additional Notes

- M4A files are compressed using the 'AAC' lossy codec. For lossless quality, use WAV or FLAC formats.
- WAV and AIFF uses the pcm_s16le codec, while OGG uses the newer Opus codec.
- Lossy formats utilize Variable Bit Rate (VBR) for increased compression.

## Audio File Type Compatibility

### RPG Maker

| Features |  MP3 |  OGG[^3] | WAV | M4A[^1] | MIDI |
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

[^1]: Not needed in 2024?
[^2]: M4A can be lossless but isn't when converted by this software.
[^3]: Opus codec for OGG files is better but Vorbis is more compatiable.

- Source: [RPGMaker.net](https://rpgmaker.net/articles/2633/)

RPG Maker **MV and MZ will play Opus but do not support loop tags**. MV will not play Opus in the editor.

If you want Opus loop tags to work to work in RMMV-MZ then you will need my plugin. 
[Download FugsOpusMV Here!](https://spacefoon.itch.io/fugs-ogg-opus-loop-tag-support-for-rmmv)

#### Unity

- **Supported Formats:** `MPEG(1/2/3), OGG Vorbis, .aiff, .mod, .it, .s3m, .xm`

Source: [Unity Documentation](https://docs.unity3d.com/352/Documentation/Manual/AudioFiles.html)

#### Godot

- **Supported Formats:** `WAV, MP3, OGG Vorbis`

Source: [Godot Documentation](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_audio_samples.html#supported-audio-formats)

#### Unreal Engine

- **Supported Format:** `WAV`
- Unreal Engine currently imports uncompressed, little endian , 16-bit Wave (WAV) files at any sample rate (although, we recommend sample rates of 44.1 kHz or 22.05 kHz).
Source: [Unreal Engine Documentation](https://docs.unrealengine.com/4.27/en-US/WorkingWithAudio/ImportingAudio/)

#### Ren'Py

- **Supported Formats:** `Ogg Opus, Ogg Vorbis, MP3, MP2, FLAC, WAV (uncompressed 16-bit signed PCM only)`

Source: [Ren'Py Documentation](https://www.renpy.org/doc/html/audio.html)

#### Game Maker Studio

- **Supported Formats:** `OGG Vorbis, MP3 and WAV`
Source: [Gamemaker.io](https://manual.gamemaker.io/monthly/en/GameMaker_Language/GML_Reference/Asset_Management/Audio/Audio.htm)

#### Additional Comparison

For a detailed comparison of audio formats for games, refer to [this article](https://dev.to/tenry/comparison-of-audio-formats-for-games-jak).

[Opus bit rate and sample info](https://wiki.xiph.org/Opus_Recommended_Settings)

## On the Web

Leave a comment and a like to support me!

[Itch.io](https://spacefoon.itch.io/ez-game-audio-format-conversion)
[Source on GitHub](https://github.com/SpaceFoon/Ez-Game-Audio-Conversion)
[RPG Maker Forums](https://forums.rpgmakerweb.com/index.php?threads/v1-3-tool-ez-batch-game-audio-converter-for-windows.163150/)
[GameJolt](https://gamejolt.com/@Fooney)
[Reddit](https://www.reddit.com/user/Puzzleheaded-Soup362/)
[Twitter](https://twitter.com/Fooney_)
[Email me](mailto:fooneyfoo@gmail.com)
[](https://ko-fi.com/fooney58825)
[](https://app.gumroad.com/dashboard)
[](https://www.gamedev.net/fooney/)
[](https://www.ascensiongamedev.com/files/file/183-ez-game-audio-conversion/)


## License

This project is licensed under the [GNU Affero General Public License (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.txt).

### Other Attributes

- [Icon Source](https://icon-icons.com/icon/audio-x-generic/36263)
