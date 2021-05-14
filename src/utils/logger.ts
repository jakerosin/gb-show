'use strict';

// packages
import path from 'path';
import { promises as fs } from 'fs';

export type LogLevel = 'off'|'silent'|'fatal'|'error'|'warn'|'info'|'log'|'debug'|'trace'|'all';

export const LogLevelNumber = {
  off: 0,
  silent: 0,  // alias for  "off"
  fatal: 100,
  error: 200,
  warn: 300,
  info: 400,
  log: 400,   // alias for "info"
  debug: 500,
  trace: 600,
  all: Infinity
}

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
  level?: LogLevel;
  wrapper?: string[];
  color?: boolean;
}

function wrap(wrapper: string[]|void, ...args): any[] {
  if (!args.length || !wrapper || !wrapper.length) return args;
  return [`${wrapper[0]}${args[0]}${wrapper[1]}`, ...args.slice(1)];
}

function colorsToWrapper(...colors: string[]): string[] {
  if (!colors.length) return [];
  const colorStrs = [] = colors.map(c => {
    if (LogColorKeys.includes(c)) {
      return LogColor[c];
    } else if (LogColorValues.includes(c)) {
      return c;
    }
    throw new Error(`Invalid Logger color ${c}`);
  });
  return [colorStrs.join(''), LogColor.reset];
}

/**
 * A terribly designed class for logging with inefficient patterns and
 * excessive, unnecessary allocations.
 *
 * TODO: if you care about the efficiency of your logger use something else.
 */
export default class Logger implements LoggerOpts {
  level: LogLevel;
  wrapper: string[];
  color: boolean;

  constructor(opts: LoggerOpts) {
    this.level = opts.level || 'warn';
    this.wrapper = opts.wrapper || [];
    this.color = opts.color || true;
  }

  in(...colors: string[]): Logger {
    if (!colors.length || colors.every(a => !a || !a.length)) {
      return this;
    }

    return new Logger({
      level: this.level,
      wrapper: colorsToWrapper(...colors),
      color: this.color
    });
  }

  out(level: number, backupWrapper: string[], ...args): void {
    if (level <= LogLevelNumber[this.level]) {
      const output = this.color ? wrap(this.wrapper.length ? this.wrapper : backupWrapper, ...args) : args;
      if (level <= LogLevelNumber.error) {
        console.error(...output);
      } else if (level <= LogLevelNumber.warn) {
        console.warn(...output);
      } else {
        console.log(...output);
      }
    }
  }

  print(...args): void {
    this.out(0, [], ...args);
  }

  trace(...args): void {
    this.out(LogLevelNumber.trace, colorsToWrapper('dim'), ...args);
  }

  debug(...args): void  {
    this.out(LogLevelNumber.debug, colorsToWrapper('dim'), ...args);
  }

  info(...args): void {
    this.out(LogLevelNumber.info, [], ...args);
  }

  log(...args): void {
    this.out(LogLevelNumber.log, [], ...args);
  }

  warn(...args): void {
    this.out(LogLevelNumber.warn, [], ...args);
  }

  error(...args): void {
    this.out(LogLevelNumber.error, [], ...args);
  }

  fatal(...args): void {
    this.out(LogLevelNumber.fatal, [], ...args);
  }
}
