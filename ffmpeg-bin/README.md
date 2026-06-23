# FFmpeg Binaries

This directory contains platform-specific ffmpeg binaries used for audio conversion.

## Directory Structure

```
ffmpeg-bin/
├── windows/
│   ├── ffmpeg.exe
│   └── ffprobe.exe
├── linux/
│   ├── ffmpeg
│   └── ffprobe
└── macos/
    ├── ffmpeg
    └── ffprobe
```

## Automatic install

`npm install` automatically downloads FFmpeg and FFprobe for the OS you are
installing on and places them in the matching platform folder.

To install npm dependencies and FFmpeg binaries with one explicit project
command, run:

```bash
npm run install
```

The binaries are placed in the matching platform folder:

- Windows: `ffmpeg-bin/windows/`
- Linux: `ffmpeg-bin/linux/`
- macOS: `ffmpeg-bin/macos/`

If the expected binaries already exist, the installer leaves them alone. To
force a fresh download, run:

```bash
EZ_AUDIO_FORCE_FFMPEG_DOWNLOAD=1 npm run install:ffmpeg
```

To skip the download step, run:

```bash
EZ_AUDIO_SKIP_FFMPEG_DOWNLOAD=1 npm install
```

## Manual download links

Use these links only if the automatic install fails or if you want to replace
the bundled binaries yourself.

### Windows
1. Download: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
2. Extract `ffmpeg.exe` and `ffprobe.exe` from the `bin/` folder
3. Place them in `ffmpeg-bin/windows/`

### Linux
1. Download: https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
2. Extract `ffmpeg` and `ffprobe`
3. Place them in `ffmpeg-bin/linux/`

### macOS
1. Download: https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip
2. Download: https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip
3. Extract and place in `ffmpeg-bin/macos/`

**OR** use Homebrew:
```bash
brew install ffmpeg
# Then copy from /opt/homebrew/bin/ or /usr/local/bin/
cp $(which ffmpeg) ffmpeg-bin/macos/
cp $(which ffprobe) ffmpeg-bin/macos/
```

## Notes

- These binaries are **NOT** committed to git (too large)
- Each developer/CI runner needs to download them once
- The build script (`npm run package`) automatically copies the correct platform's binaries
- When you run `npm run package` on Windows, it only needs `windows/` binaries
- For multi-platform releases, build on each platform (or use GitHub Actions)

## Building Multi-Platform Releases

### Option 1: Manual (Build on each OS)
1. Build on Windows → Creates Windows release with Windows ffmpeg
2. Build on Linux → Creates Linux release with Linux ffmpeg
3. Build on macOS → Creates macOS release with macOS ffmpeg

### Option 2: GitHub Actions (Recommended)
Use the CI workflow to build on all platforms automatically.
