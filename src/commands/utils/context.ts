'use strict';

import Logger from  '../../utils/logger';
import Parser from './parser';

import { VideoShow } from '../../api';

export const ERROR = {
  NONE: 0,
  UNKNOWN_COMMAND: 1,
  NO_TOKEN: 2,
  UNKNOWN_SHOW: 3,
  UNKNOWN_VIDEO: 4,
  WHAT: 1000
}

export const DEFAULT = {

}

export interface Context {
  logger: Logger;
  api_key: string;
  copy_year: boolean;
}

export interface Command {
  aliases: string[];
  summary: string;
  parser?: Parser;
  process: (argv: string[], context: Context) => Promise<number>;
}
