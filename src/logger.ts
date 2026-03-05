type LoggerArgs = unknown[];

const logger = {
  log: (...args: LoggerArgs): void => {
    console.log(...args);
  },

  info: (...args: LoggerArgs): void => {
    console.log(...args);
  },

  warn: (...args: LoggerArgs): void => {
    console.warn(...args);
  },

  error: (...args: LoggerArgs): void => {
    console.error(...args);
  },

  debug: (...args: LoggerArgs): void => {
    console.debug(...args);
  },
};

export default logger;
