'use strict';

import Logger from  './logger';
import Parser  from './parser';

export const ERROR = {
  NONE: 0,
  UNKNOWN_COMMAND: 1,
  NO_TOKEN: 2
}

export const DEFAULT = {

}

export interface Context {
  logger: Logger;
  api_key: string;
}

export interface Command {
  aliases: string[];
  summary: string;
  parser?: Parser;
  process: (argv: string[], context: Context) => Promise<number>;
}
