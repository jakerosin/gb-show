'use strict';

// packages
import path from 'path';
import { promises as fs } from 'fs';

export const LogColor = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  fgBlack: "\x1b[30m",
  fgRed: "\x1b[31m",
  fgGreen: "\x1b[32m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgMagenta: "\x1b[35m",
  fgCyan: "\x1b[36m",
  fgWhite: "\x1b[37m",

  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m"
};

const LogColorKeys = Object.keys(LogColor);
const LogColorValues = Object.values(LogColor);

interface LoggerOpts {
  silent: boolean;
  verbose: boolean;
}

export default class Logger {
  silent: boolean;
  verbose: boolean;

  constructor(opts: LoggerOpts) {
    this.silent = opts.silent;
    this.verbose = opts.verbose;
  }

  print(str: string = '', ...colors: string[]): void {
    if (!colors.length) {
      console.log(str);
      return;
    }

    const colorStrs = [] = colors.map(c => {
      if (LogColorKeys.includes(c)) {
        return LogColor[c];
      } else if (LogColorValues.includes(c)) {
        return c;
      }
      throw new Error(`Invalid Logger color ${c}`);
    });

    const formatStr = `${colorStrs.join('')}%s${LogColor.reset}`;
    console.log(formatStr, str);
  }

  info(...args): void {
    if (this.verbose) console.log(...args);
  }

  debug(...args): void  {
    if (!this.silent) console.log(...args);
  }

  warn(...args): void {
    if (!this.silent) console.warn(...args);
  }

  error(...args): void {
    if (!this.silent) console.error(...args);
  }

  fatal(...args): void {
    console.error(...args);
  }
}
