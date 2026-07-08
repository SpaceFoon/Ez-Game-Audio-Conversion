import readline from 'readline';
import chalk from 'chalk';
import logger from './logger.js';

// How many lines to show when we can't page interactively (piped output, CI).
const NON_INTERACTIVE_PREVIEW = 20;

type KeyName = 'up' | 'down' | 'pageup' | 'pagedown' | 'home' | 'end' | string;

/** Compute the next scroll offset for a navigation key, clamped to the list. */
export const moveOffset = (
  offset: number,
  key: KeyName,
  total: number,
  pageSize: number
): number => {
  const maxOffset = Math.max(0, total - pageSize);
  let next = offset;
  switch (key) {
    case 'up':
      next = offset - 1;
      break;
    case 'down':
      next = offset + 1;
      break;
    case 'pageup':
      next = offset - pageSize;
      break;
    case 'pagedown':
      next = offset + pageSize;
      break;
    case 'home':
      next = 0;
      break;
    case 'end':
      next = maxOffset;
      break;
    default:
      return offset;
  }
  return Math.max(0, Math.min(next, maxOffset));
};

/** Truncate a display line so it never wraps (wrapping breaks redraw math). */
export const truncateLine = (line: string, width: number): string =>
  line.length < width ? line : `${line.slice(0, Math.max(1, width - 2))}…`;

const isExitKey = (key: { name?: string; ctrl?: boolean }): boolean =>
  Boolean(key.ctrl && key.name === 'c') ||
  key.name === 'q' ||
  key.name === 'return' ||
  key.name === 'escape';

const interactivePager = (
  label: string,
  items: string[],
  pageSize: number
): Promise<void> =>
  new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let offset = 0;
    let renderedLines = 0;

    const render = (): void => {
      if (renderedLines > 0) {
        readline.moveCursor(stdout, 0, -renderedLines);
        readline.cursorTo(stdout, 0);
        readline.clearScreenDown(stdout);
      }
      const width = stdout.columns && stdout.columns > 10 ? stdout.columns : 80;
      const end = Math.min(offset + pageSize, items.length);
      const lines = [
        chalk.bold(`${label} (${offset + 1}-${end} of ${items.length})`),
        ...items.slice(offset, end).map((line) => truncateLine(line, width)),
        chalk.blue(
          '↑/↓ scroll   PgUp/PgDn page   Home/End jump   ENTER or q to continue'
        ),
      ];
      stdout.write(`${lines.join('\n')}\n`);
      renderedLines = lines.length;
    };

    readline.emitKeypressEvents(stdin);

    // The app-wide readline interface also listens for keypress events and
    // would treat arrows as line editing. Detach its listeners while the
    // pager owns the keyboard, and restore them on exit.
    const saved = stdin.rawListeners('keypress') as Array<
      (...args: unknown[]) => void
    >;
    for (const listener of saved) stdin.removeListener('keypress', listener);

    const wasRaw = Boolean(stdin.isRaw);
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();

    const onKeypress = (
      _str: string | undefined,
      key: { name?: string; ctrl?: boolean } = {}
    ): void => {
      if (isExitKey(key)) {
        stdin.removeListener('keypress', onKeypress);
        for (const listener of saved) stdin.on('keypress', listener);
        if (stdin.setRawMode) stdin.setRawMode(wasRaw);
        resolve();
        return;
      }
      const next = moveOffset(offset, key.name ?? '', items.length, pageSize);
      if (next !== offset) {
        offset = next;
        render();
      }
    };

    stdin.on('keypress', onKeypress);
    render();
  });

/**
 * Print a list of file paths without flooding the terminal.
 *
 * - Fits on one screen: plain print, no interaction (small batches unchanged).
 * - Interactive TTY: show one screenful, navigate with arrows/PgUp/PgDn/Home/End.
 * - Piped / CI / tests: preview the first lines plus a "see <csv>" pointer.
 */
export const showPagedList = async (
  label: string,
  items: string[],
  moreHint = 'see logs.csv'
): Promise<void> => {
  if (items.length === 0) return;

  const stdout = process.stdout;
  const rows = stdout.rows && stdout.rows > 8 ? stdout.rows : 24;
  const pageSize = Math.max(5, rows - 4);

  if (items.length <= pageSize) {
    logger.log(items.join('\n'));
    return;
  }

  const interactive =
    Boolean(stdout.isTTY) &&
    Boolean(process.stdin.isTTY) &&
    typeof process.stdin.setRawMode === 'function' &&
    !process.env.JEST_WORKER_ID;

  if (!interactive) {
    logger.log(items.slice(0, NON_INTERACTIVE_PREVIEW).join('\n'));
    logger.log(
      `… and ${items.length - NON_INTERACTIVE_PREVIEW} more (${moreHint}).`
    );
    return;
  }

  await interactivePager(label, items, pageSize);
};
