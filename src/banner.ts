/**
 * SEA banner: the sentinel below is replaced with the exact cfonts
 * ANSI output string by scripts/gen-banner.js during the build:sea pipeline.
 * The banner is left-aligned in the string and centered at runtime based on
 * the actual terminal width, so it adapts to any screen size.
 */

const BANNER_SNAPSHOT = '__SEA_BANNER__';

export function stripAnsiSgr(input: string): string {
  let output = '';

  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) === 27 && input[i + 1] === '[') {
      let j = i + 2;

      while (j < input.length) {
        const code = input.charCodeAt(j);
        if (!((code >= 48 && code <= 57) || code === 59)) {
          break;
        }
        j++;
      }

      if (j < input.length && input[j] === 'm') {
        i = j;
        continue;
      }
    }

    output += input[i];
  }

  return output;
}

export function renderSeaBanner(): string {
  const lines = BANNER_SNAPSHOT.split('\n');
  const cols = process.stdout.columns ?? 120;

  return lines
    .map((line) => {
      // Strip ANSI codes to measure visible width
      const visible = stripAnsiSgr(line);
      const padding = Math.max(0, Math.floor((cols - visible.length) / 2));
      return ' '.repeat(padding) + line;
    })
    .join('\n');
}
