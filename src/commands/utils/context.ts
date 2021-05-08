'use strict';

import Logger from  '../../utils/logger';
import Parser  from './parser';

export const ERROR = {
  NONE: 0,
  UNKNOWN_COMMAND: 1,
  NO_TOKEN: 2,
  WHAT: 1000
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
