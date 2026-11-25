#!/usr/bin/env node
// Portfolio screenshot of the real terminal UI: ez-game-audio-readme.png.
//
// 1. Generates a tiny fictional game-audio library (sine/noise test tones).
// 2. Runs the built app (dist/app.js) in a pseudo-terminal via `script`,
//    answering its prompts, so every conversion on screen really happens.
// 3. Replays the recorded terminal output into xterm.js in headless Chromium
//    and screenshots it at 1361x651.
//
// Usage (from the repo root, after `npm run build` and `npm run install:ffmpeg`):
//   npm run portfolio:media -- [outDir]       (default outDir: portfolio-media/)
//
// See scripts/portfolio-media/README.md.
/* global document, window, requestAnimationFrame -- used inside page.evaluate() */
import { spawn, execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const outDir = resolve(process.argv[2] || join(repoRoot, 'portfolio-media'));
const OUTPUT_NAME = 'ez-game-audio-readme.png';
const WIDTH = 1361;
const HEIGHT = 651;
const COLS = 138;
const ROWS = 30;
const FONT_SIZE = 16;

// The work folder is `/tmp/ezga-XXXXXX` (16 characters). On screen it is
// shown as a fictional project folder of the same length, so no real path,
// user name or random suffix is ever rendered and line wrapping is unchanged.
const DISPLAY_ROOT = '~/Games/Starfall';

const log = (...args) => console.log('[portfolio-media]', ...args);

const findTool = (name) => {
  const bundled = join(repoRoot, 'ffmpeg-bin', 'linux', name);
  if (existsSync(bundled)) return bundled;
  return name; // fall back to PATH
};

const appEntry = join(repoRoot, 'dist', 'app.js');
if (!existsSync(appEntry)) {
  console.error('dist/app.js is missing. Run `npm run build` first.');
  process.exit(1);
}
if (!existsSync(join(repoRoot, 'ffmpeg-bin', 'linux', 'ffmpeg'))) {
  console.error(
    'ffmpeg-bin/linux/ffmpeg is missing. Run `npm run install:ffmpeg` first.'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Fictional library: "Starfall" game audio, ~0.4 s generated tones.
// ---------------------------------------------------------------------------
const workRoot = mkdtempSync('/tmp/ezga-');
// Remove the work folder however the run ends (a failed capture used to leave it).
process.on('exit', () => rmSync(workRoot, { recursive: true, force: true }));
if (workRoot.length !== DISPLAY_ROOT.length) {
  throw new Error(`Unexpected work folder length: ${workRoot}`);
}
const libraryDir = join(workRoot, 'audio');
const exportDir = join(workRoot, 'export');

const ffmpeg = findTool('ffmpeg');
const tone = (relPath, source, extra = []) => {
  const file = join(libraryDir, relPath);
  mkdirSync(dirname(file), { recursive: true });
  execFileSync(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      source,
      '-t',
      '0.4',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-fflags',
      '+bitexact',
      ...extra,
      '-y',
      file,
    ],
    { stdio: 'inherit' }
  );
};

const meta = (title) => [
  '-metadata',
  `title=${title}`,
  '-metadata',
  'artist=Starfall Audio Team',
  '-metadata',
  'album=Starfall OST (demo)',
];
const loop = (start, length) => [
  '-metadata',
  `LOOPSTART=${start}`,
  '-metadata',
  `LOOPLENGTH=${length}`,
];

tone('music/title-theme.flac', 'sine=frequency=220', [
  ...meta('Title Theme'),
  ...loop(4410, 13230),
]);
tone('music/boss-battle.flac', 'sine=frequency=330', [
  ...meta('Boss Battle'),
  ...loop(2205, 15435),
]);
tone('ambience/space-station-hum.aiff', 'sine=frequency=110', meta('Hum'));
tone('sfx/laser-shot.wav', 'sine=frequency=880', meta('Laser Shot'));
tone('sfx/coin-pickup.wav', 'sine=frequency=1320', meta('Coin Pickup'));
tone('sfx/shield-up.wav', 'sine=frequency=660', meta('Shield Up'));
tone('ui/menu-select.wav', 'sine=frequency=990', meta('Menu Select'));
log(`Generated fixture library in ${libraryDir}`);

// ---------------------------------------------------------------------------
// 2. Run the real app in a pseudo-terminal and answer its prompts.
// ---------------------------------------------------------------------------
const answers = [
  // [text that must appear on screen, what to type]
  ['Input Folder Path', libraryDir],
  ['Enter the output folder', exportDir],
  ['Enter the file extensions to look for', ''],
  ['Enter the output formats', 'ogg, mp3'],
  ['Vorbis or Opus?', ''],
  ['Loop tags: ', ''], // fixtures carry loop tags: keep them
  ['Start now?', 'yes'],
  ['Press ENTER to run another conversion', null], // end of the run
];

const env = {
  PATH: process.env.PATH,
  HOME: workRoot,
  USER: 'dev',
  LOGNAME: 'dev',
  LANG: 'C.UTF-8',
  LC_ALL: 'C.UTF-8',
  TZ: 'UTC',
  TERM: 'xterm-256color',
  COLORTERM: 'truecolor',
  FORCE_COLOR: '3',
  NODE_ENV: 'production',
  EZGA_CAPTURE_CORES: '8',
};

const preload = pathToFileURL(join(here, 'deterministic.mjs')).href;
const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const inner = [
  `stty rows ${ROWS} cols ${COLS}`,
  `exec ${quote(process.execPath)} --import ${quote(preload)} ${quote(appEntry)}`,
].join('; ');

const transcript = await new Promise((resolvePromise, reject) => {
  const child = spawn('script', ['-qfec', inner, '/dev/null'], {
    cwd: workRoot,
    env,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  let output = '';
  let step = 0;
  let scanFrom = 0;
  let finished = false;
  const timer = setTimeout(() => {
    child.kill('SIGKILL');
    reject(
      new Error(
        `Timed out waiting for "${answers[step]?.[0]}".\n--- output ---\n${output}`
      )
    );
  }, 120_000);

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    output += chunk;
    while (step < answers.length) {
      const [expect, reply] = answers[step];
      const at = output.indexOf(expect, scanFrom);
      if (at === -1) break;
      scanFrom = at + expect.length;
      step++;
      if (reply === null) {
        finished = true;
        // Snapshot the screen here, then quit the app.
        setTimeout(() => {
          resolvePromise(output);
          child.stdin.write('q\r');
        }, 500);
        break;
      }
      // Type the answer once the prompt has fully rendered.
      setTimeout(() => child.stdin.write(`${reply}\r`), 150);
    }
  });
  child.on('exit', (code) => {
    clearTimeout(timer);
    if (!finished) {
      reject(new Error(`App exited (code ${code}) early.\n${output}`));
    }
  });
  child.on('error', reject);
});

const outputs = execFileSync('find', [exportDir, '-type', 'f'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((f) => /\.(ogg|mp3)$/.test(f));
log(`App converted ${outputs.length} files for real.`);
if (outputs.length !== 14) {
  throw new Error(`Expected 14 converted files, found ${outputs.length}`);
}

// Replace the temporary folder with the fictional project folder and check
// that nothing machine-specific is left in what will be rendered.
const screenText = transcript.split(workRoot).join(DISPLAY_ROOT);
const forbidden = [
  repoRoot,
  process.env.HOME,
  process.env.USER,
  workRoot,
  '/tmp/',
].filter((s) => s && s.length > 2);
for (const word of forbidden) {
  if (screenText.includes(word)) {
    throw new Error(`Refusing to render: screen contains "${word}"`);
  }
}
rmSync(workRoot, { recursive: true, force: true });

// ---------------------------------------------------------------------------
// 3. Render with xterm.js in headless Chromium.
// ---------------------------------------------------------------------------
const nm = join(here, 'node_modules');
const fileUrl = (p) => pathToFileURL(join(nm, p)).href;
const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="${fileUrl('@xterm/xterm/css/xterm.css')}">
<link rel="stylesheet" href="${fileUrl('@fontsource/jetbrains-mono/400.css')}">
<link rel="stylesheet" href="${fileUrl('@fontsource/jetbrains-mono/700.css')}">
<link rel="stylesheet" href="${fileUrl('@fontsource/jetbrains-mono/400-italic.css')}">
<link rel="stylesheet" href="${fileUrl('noto-color-emoji/noto-color-emoji.css')}">
<style>
  html, body { margin: 0; background: #0d0d0d; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  #term { position: absolute; left: 18px; top: 10px; }
  .xterm-viewport { overflow: hidden !important; }
  .xterm .scrollbar { display: none !important; }
</style>
<script src="${fileUrl('@xterm/xterm/lib/xterm.js')}"></script>
<script src="${fileUrl('@xterm/addon-unicode11/lib/addon-unicode11.js')}"></script>
</head><body><div id="term"></div></body></html>`;
const pageFile = join(here, '.render.html');
writeFileSync(pageFile, html);

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  args: ['--font-render-hinting=none', '--disable-lcd-text'],
});
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(pageFile).href);
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('15px "JetBrains Mono"'),
      document.fonts.load('bold 15px "JetBrains Mono"'),
      document.fonts.load('italic 15px "JetBrains Mono"'),
      document.fonts.load(
        '15px "NotoColorEmoji"',
        '✅🔍🛠️👷‍♂️📝🎶📁🔊🧵🕵️‍♂️🖥🕖📤📋✨🔌💡🎵🎮🚗💪🎼🚨✏️📂'
      ),
    ]);
  });
  await page.evaluate(
    ({ cols, rows, data, FONT_SIZE }) =>
      new Promise((done) => {
        const term = new window.Terminal({
          cols,
          rows,
          fontFamily: '"JetBrains Mono", "NotoColorEmoji", monospace',
          fontSize: FONT_SIZE,
          lineHeight: 1,
          cursorBlink: false,
          cursorStyle: 'bar',
          allowProposedApi: true,
          scrollback: 5000,
          theme: { background: '#0d0d0d', foreground: '#d8d8d8' },
        });
        const unicode = new window.Unicode11Addon.Unicode11Addon();
        term.loadAddon(unicode);
        term.unicode.activeVersion = '11';
        term.open(document.getElementById('term'));
        term.focus(); // solid cursor, as in a live terminal
        window.__term = term;
        term.write(data, () => {
          term.scrollToBottom();
          requestAnimationFrame(() => requestAnimationFrame(done));
        });
      }),
    { cols: COLS, rows: ROWS, data: screenText, FONT_SIZE }
  );
  const size = await page.evaluate(() => {
    const el = document.querySelector('.xterm-screen');
    return [el.clientWidth, el.clientHeight];
  });
  log(`Terminal ${COLS}x${ROWS} renders at ${size.join('x')} px`);
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, OUTPUT_NAME);
  await page.screenshot({ path: target, animations: 'disabled' });
  log(`Wrote ${target}`);
} finally {
  await browser.close();
  rmSync(pageFile, { force: true });
}

// Keep transcript handy for debugging when asked.
if (process.env.EZGA_CAPTURE_DEBUG) {
  writeFileSync(join(outDir, 'transcript.txt'), screenText);
}
