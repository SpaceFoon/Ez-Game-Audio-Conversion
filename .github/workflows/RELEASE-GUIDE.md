# Release Guide

This guide explains how to create a new release for EZ Game Audio Conversion.

## Automated Multi-Platform Builds

The project uses GitHub Actions to automatically build release packages for Windows, Linux, and macOS.

## Creating a Release

### Method 1: Git Tag (Recommended)

1. **Update version in package.json:**
   ```bash
   # Edit package.json and change version to your new version
   # Example: "1.6.0" → "1.7.0"
   ```

2. **Commit your changes:**
   ```bash
   git add .
   git commit -m "chore: bump version to v1.7.0"
   ```

3. **Create and push a tag:**
   ```bash
   git tag v1.7.0
   git push origin main
   git push origin v1.7.0
   ```

4. **GitHub Actions will automatically:**
   - ✅ Build on Windows, Linux, and macOS runners
   - ✅ Download platform-specific ffmpeg binaries
   - ✅ Compile TypeScript to ESM
   - ✅ Create Single Executable Applications
   - ✅ Generate documentation (HTML/PDF)
   - ✅ Create ZIP/7z archives
   - ✅ Create a **draft** GitHub Release with all artifacts

5. **Finalize the release:**
   - Go to: https://github.com/SpaceFoon/Ez-Game-Audio-Conversion/releases
   - Find your draft release
   - Edit release notes if needed
   - Click **Publish release**

### Method 2: Manual Trigger

1. Go to: https://github.com/SpaceFoon/Ez-Game-Audio-Conversion/actions/workflows/release.yml
2. Click **Run workflow**
3. Select the branch
4. Click **Run workflow**

This will build all platforms but won't create a GitHub Release (only tags do that).

## What Gets Built

Each platform creates a separate release archive:

### Windows (`EZ-Game-Audio-Windows.zip` + `.7z`)
- `ez-game-audio.exe` - Single executable application
- `ffmpeg.exe` - Audio conversion binary
- `ffprobe.exe` - Metadata extraction binary
- `README.html` - Documentation (HTML)
- `README.pdf` - Documentation (PDF)
- `LICENSE` - License file
- `add_context_menu.bat` - Windows context menu integration
- `remove_context_menu.bat` - Uninstall context menu

Note: For Windows builds, the packaged `.exe` icon + version metadata is applied automatically during `npm run package`. To disable this (rare), set `POST_SEA_SKIP_ICON=1`.

### Linux (`EZ-Game-Audio-Linux.zip`)
- `ez-game-audio` - Single executable application
- `ffmpeg` - Audio conversion binary
- `ffprobe` - Metadata extraction binary
- `README.html` - Documentation (HTML)
- `README.pdf` - Documentation (PDF)
- `LICENSE` - License file

### macOS (`EZ-Game-Audio-macOS.zip`)
- `ez-game-audio` - Single executable application
- `ffmpeg` - Audio conversion binary
- `ffprobe` - Metadata extraction binary
- `README.html` - Documentation (HTML)
- `README.pdf` - Documentation (PDF)
- `LICENSE` - License file

## Versioning

Follow [Semantic Versioning](https://semver.org/):

- **Major** (v2.0.0): Breaking changes
- **Minor** (v1.7.0): New features, backwards compatible
- **Patch** (v1.6.1): Bug fixes

## Troubleshooting

### Build fails on a platform

Check the Actions logs:
1. Go to the Actions tab
2. Click on the failed workflow run
3. Expand the failed step to see error logs

Common issues:
- **ffmpeg download fails**: The download URLs might have changed
- **npm ci fails**: Dependency issues - check package-lock.json
- **SEA build fails**: Make sure all source files are proper ESM

### Release not created

Releases are only created for tags starting with `v`. Make sure:
- Tag starts with `v` (e.g., `v1.7.0` not `1.7.0`)
- Tag was pushed: `git push origin v1.7.0`

### Missing artifacts

Check that `npm run package` works locally on your platform first.

## Testing Before Release

You can test the build locally on each platform:

```bash
# Install dependencies
npm ci

# Download ffmpeg for your platform (see ffmpeg-bin/README.md)

# Build
npm run package

# Test the executable
./release/ez-game-audio.exe  # Windows
./release/ez-game-audio      # Linux/macOS
```

## Manual Release (Fallback)

If GitHub Actions fails, you can build manually:

1. **On Windows:**
   ```powershell
   npm ci
   # Add ffmpeg to ffmpeg-bin/windows/
   npm run package
   # Upload release/EZ-Game-Audio-Windows.zip to GitHub Release
   ```

2. **On Linux:**
   ```bash
   npm ci
   # Add ffmpeg to ffmpeg-bin/linux/
   npm run package
   # Upload release/EZ-Game-Audio-Linux.zip to GitHub Release
   ```

3. **On macOS:**
   ```bash
   npm ci
   # Add ffmpeg to ffmpeg-bin/macos/
   npm run package
   # Upload release/EZ-Game-Audio-macOS.zip to GitHub Release
   ```
