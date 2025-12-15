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

## Download Links

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
