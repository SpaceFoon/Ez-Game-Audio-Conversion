# Portfolio media capture

Renders `ez-game-audio-readme.png` (1361×651) for the portfolio: the real
terminal UI finishing a conversion run of a small fictional game-audio library.
CI runs it in `.github/workflows/portfolio-media.yml` and uploads the file as
the `portfolio-media` artifact, which the portfolio imports without review.

## Run it locally (Linux)

```bash
npm ci                         # app deps + ffmpeg-bin/linux
npm run portfolio:media:setup  # capture deps + Playwright Chromium (once)
npm run portfolio:media        # writes portfolio-media/ez-game-audio-readme.png
npm run portfolio:media -- /some/other/folder
```

Needs `script` (util-linux) for the pseudo-terminal.

## How it works

1. `capture.mjs` generates seven 0.4 s test tones (`music/`, `sfx/`, `ui/`,
   `ambience/` of a made-up game, "Starfall") in `/tmp/ezga-XXXXXX`.
2. It runs the built app (`dist/app.js`) in a pseudo-terminal through
   `script`, at 138×30, and types the answers to its prompts. The app really
   converts the tones to OGG (Vorbis) and MP3 with ffmpeg; the script checks
   that 14 files came out.
3. The recorded terminal output is written into xterm.js in headless Chromium
   and screenshotted.

## What keeps it private and deterministic

- The temp folder is replaced on screen by `~/Games/Starfall` (same length, so
  wrapping is unchanged). The script refuses to render if the output still
  contains the repo path, `$HOME`, `$USER` or `/tmp/`.
- The app runs with a minimal environment (`HOME` is the temp folder,
  `USER=dev`, `TZ=UTC`).
- `deterministic.mjs` is preloaded into the app only for this capture. It
  reports 8 CPU cores, releases worker results in the order the workers were
  started, and replaces the clock with a simulated one, so the thread count,
  log order and timings on screen are the same on every machine. Those timings
  are illustrative; the conversions themselves are real.
- Fonts come from pinned npm packages (JetBrains Mono, Noto Color Emoji 1.0.1),
  not from the machine, so an unchanged UI gives identical PNG bytes.

The emoji font is the older CBDT Noto build because Chromium draws the
`@fontsource/noto-color-emoji` COLR/SVG build as blank.
