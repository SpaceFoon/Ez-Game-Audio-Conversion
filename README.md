<!-- # <span style="color:red">EZ Game Audio Conversion </span> -->
![Title Image](dist/assets/title3.webp
)

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/SpaceFoon/Ez-Game-Audio-Conversion/total)

[![Download Now](https://img.shields.io/badge/Download%20Now-%23ff00ff?style=for-the-badge&logo=appveyor)](https://github.com/SpaceFoon/Ez-Game-Audio-Conversion/releases/)

<!-- Pre-Headline -->
<p style="font-size: 16px; color: yellow; text-align: center;">Boost your productivity and streamline your workflow today!</p>

<!-- <span style="color:red">**"The Best Unattended Batch Audio Conversion Tool There is"**</span> -->

## Why I built Ez-Game-Audio-Conversion

I started this project after wasting many hours finding, organizing and converting assets for my game project. When you are using mostly free assets from different sources with different formats, bitrates and naming conventions, it can be a real headache and a huge time sink. If you spend all day learning how audio files work, you just spent all day getting nothing done in your project. You shouldn't have to be a audio engineer or terminal wizard just to have audio in the right format.

The Problem: Game devs and anyone else who needs to convert audio files for whatever reason, need to know a lot about digital audio before they can even get started. This is a huge barrier to entry for new game devs and a huge time sink for experienced ones.

As a new game dev, you soon may notice that you are spending more time on asset management than actual game development. I don't think game devs should spend any time learning things that are not specific to actually making games. In fact, I don't think anyone who wants some audio files converted or compressed should have to spend an entire weekend learning about audio formats and bitrates like I did.

This tool started as just a few lines of code to convert audio files for my game development projects after realized I quickly realized that the process was tedious and time-consuming. As a game developer, you are forced to wear many hats, you have to choose audio formats, bitrates, codecs, and more. The entire time you are doing and learning about this, you NOT working on your game. I wanted to create a tool that would take the guesswork out of the process and make it as easy and fast as possible. I personally use this tool for my projects.

## Introduction

EZ-Game-Audio-Conversion streamlines the process of batch audio conversion. Tailored specifically for game developers, this tool ensures great audio quality and small file sizes without the need for extensive knowledge. With almost no setup and multi-threaded conversion, it's the easiest, fastest and most reliable solution available. Plus, now with support for loop tags!

## Feature

- 💻 **User-Friendly Interface:** Designed with simplicity as the main goal, eliminating any learning curve.
- 🔄 **Unattended Batch Jobs:** With recursive file searching and unattended conflict resolution, set it and forget it.
- 🚀 **Multi-threading:** No job too big or small when all your CPU cores are fully utilized.
- 🎵 **Automatic Bitrate and Codec Selection:** Automatically selects the best codec and Variable Bitrate (VBR) at 160kbs(mp3) or near equivalent. Balanced between great sound quality and small file size.
- 📁 **Comprehensive Format Support:** Converts between WAV, MP3, OGG, FLAC, AIFF, and M4A formats. WMA to come.
- 🔒 **Privacy and Reliability:** Operates offline, ensuring data privacy and reliability.
- 🎶 **High-Quality Output:** Employs FFMPEG for superior sound quality, codec support, and speed.
- 🤖 **Intelligent File Handling:** Automatically resolves duplicate file names with different file extensions. Selects the best input file format.
- 📝 **Meta Data Support:** Will transfer all basic meta data to and from all formats that support it.
- 🔁 **Loop Tag Support:** All loop meta data will be transferred to new Ogg or FLAC files. When changing sample rate, loop timings will be adjusted automatically. Cannot write loop tags TO M4A, only FROM.
- 🎼 **Opus AND Vorbis Support for Ogg:** Use Opus when you can and Vorbis when you have to.

## Installation

1. **Download** Zip "EZ-Game-Audio.zip"
2. **Extract**  Folder "EZ-Game-Audio-Converter"
3. **Run** File "EZ-Game-Audio.exe"

## Prerequisites

- Windows PC
- Not required: Windows Terminal from the Windows Store for enhanced visual experience (emoji support 😎 ).

## Usage

1. **Setup:** Follow the setup prompts. It's recommended to copy and paste file paths. Right-click to paste.

2. **File Selection:** The application will search for matching files based on the provided criteria and display the list of input files to be converted.

3. **Duplicate Handling:** Duplicate file names with different extensions will be automatically resolved, retaining the best or lossless format.

4. **Conflict Resolution:** Resolve conflicts for conflicting output files:
   - `O`: Overwrite file with the same name. File will not overwrite itself but will skip instead.
   - `R`: Rename the file.
   - `S`: Skip the conversion for this file.
   - Adding `a` to your selection will apply it to all subsequent files.

5. **Confirmation:** Review the list of files to be converted and confirm by typing "yes" or "no" when prompted.

6. **Conversion:** Monitor progress and any errors during the conversion process. Upon completion, logs.csv will be available at the specified file path. Any errors will be logged separately to errors.csv. Some files may produce errors but still convert correctly.

## Source

Prefer a hands-on approach over trusting random files from the internet? Here's how:

1. Clone the repository or download.

2. In the project folder, run `npm i` then `npm run build` to build the executable.
 OR
2. Run `npm i` then `npm run start` to run from your terminal.

3. Remember to have `ffmpeg.exe` and `ffprobe.exe` located alongside wherever you run the application from.
[FFMPEG Essentials Build Download](https://www.gyan.dev/ffmpeg/builds/#release-builds)

To change things like bitrate and codec, look in `converterWorker.js`.

[On Github](https://github.com/SpaceFoon/Ez-Game-Audio-Conversion)

### Additional Notes

- M4A files are compressed using the 'AAC' lossy codec. For lossless quality, use WAV or FLAC formats.
- WAV and AIFF uses the pcm_s16le codec, while OGG uses the older and more compatible Vorbis codec by default.
- Lossy formats utilize Variable Bit Rate (VBR) for increased compression.
- Loop tags are only supported for OGG FLAC and AIFF formats. This software cannot write loop tags to M4A files but can read them when converting to another format. Sorry, but it's a total pain to fix.

## Audio File Type Compatibility

### RPG Maker

| Features |  MP3 |  OGG[^3] | WAV | M4A[^1] | MIDI |
|--|--|--|--|--|--|
| Loop OK | NO | YES | YES | YES | YES |
| Loop Inside (Tags)[^4] | NO | YES | NO | YES | YES |
| File Size Optimize | YES | YES | NO | YES[^2] | OMG YES |
| Realistic Sound | YES | YES | YES | YES | NO |
| RMVX/Ace Compatible| YES | YES | YES | NO | YES |
| RMXP Compatible | YES | YES | YES | NO | YES |
| RM2003 Compatible | YES | NO | YES | NO | YES |
| RMMV Compatible | NO | YES | NO | YES | NO |
| RMMZ Compatible | NO | YES | NO | NO | NO |

[^1]: Not needed in 2024? Update: I don't care what they say, it's not needed.
[^2]: M4A can be lossless but isn't when converted by this software.
[^3]: Opus codec for OGG files is better but Vorbis is more compatible.
[^4]: As opposed to the basic looping of an audio file which simply replays the file, loop Tags are a way to tell the game engine where to start and end the loop. Example: A song or background sound effect may start at 0:00 and end at 1:00 but loop from 0:30 to 1:00. This avoids replaying intros in songs and makes seamless loops possible in music and sound effects.

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

- **Supported Formats:** `Ogg Opus, Ogg Vorbis, MP3, MP2, FLAC, AIFF WAV (uncompressed 16-bit signed PCM only)`

Source: [Ren'Py Documentation](https://www.renpy.org/doc/html/audio.html)

#### Game Maker Studio

- **Supported Formats:** `OGG Vorbis, MP3 and WAV`
Source: [Gamemaker.io](https://manual.gamemaker.io/monthly/en/GameMaker_Language/GML_Reference/Asset_Management/Audio/Audio.htm)

#### Additional Comparison

[Detailed comparison of audio formats for games](https://dev.to/tenry/comparison-of-audio-formats-for-games-jak).

[Opus bit rate and sample info](https://wiki.xiph.org/Opus_Recommended_Settings)

[Some testing on performance](https://stsaz.github.io/fmedia/audio-formats/)

[Comparison of coding efficiency between Opus and other popular audio formats](https://en.wikipedia.org/wiki/Opus_(audio_format)#Quality_comparison_and_low-latency_performance)

## **Find me on the web:**

**Your comments and likes are appreciated for support!**

[Itch.io](https://spacefoon.itch.io/ez-game-audio-format-conversion)
[Source on GitHub](https://github.com/SpaceFoon/Ez-Game-Audio-Conversion)
[RPG Maker Forums](https://forums.rpgmakerweb.com/index.php?threads/v1-3-tool-ez-batch-game-audio-converter-for-windows.163150/)
[GameJolt](https://gamejolt.com/@Fooney)
[](https://ko-fi.com/fooney58825)
[](https://app.gumroad.com/dashboard)
[](https://www.gamedev.net/fooney/)
[Download mirror: ascensiongamedev.com](https://www.ascensiongamedev.com/files/file/183-ez-game-audio-conversion/)

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License.](http://creativecommons.org/licenses/by-nc/4.0/).

If you would like to use this software for commercial purposes, please contact me on [Itch.io](https://spacefoon.itch.io/ez-game-audio-format-conversion) or [GameJolt](https://gamejolt.com/@Fooney) for licensing options. I just want to get paid if you are selling my work.

### Attribution

- [Icon Source](https://icon-icons.com/icon/audio-x-generic/36263)

