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

function stringToBoolean(s: string|void): boolean|void {
  if (s) {
    switch(s.toLowerCase().trim()) {
      case "true": case "yes": case "1": return true;
      case "false": case "no": case "0": case null: return false;
      default: return Boolean(s);
    }
  }
}

function stringToNumber(s: string|void, multiplier?: number): number|void {
  if (s) {
    const n = Number(s);
    if (!isNaN(n)) {
      return n * multiplier;
    }
  }
}

export const DEFAULT = {
  // base-level options
  api_key: process.env.GBSHOW_TOKEN || process.env.GIANTBOMB_TOKEN,
  log_level: process.env.GBSHOW_LOG_LEVEL || 'warn',
  no_color: stringToBoolean(process.env.GBSHOW_LOG_NO_COLOR),
  copy_year: stringToBoolean(process.env.GBSHOW_COPY_YEAR),

  // command options
  season_type: process.env.GBSHOW_SEASON_TYPE,
  quality: process.env.GBSHOW_QUALITY,
  out: process.env.GBSHOW_OUT,
  video_out: process.env.GBSHOW_VIDEO_OUT,
  image_out: process.env.GBSHOW_IMAGE_OUT,
  metadata_out: process.env.GBSHOW_METADATA_OUT,
  show_out: process.env.GBSHOW_SHOW_OUT,
  show_image_out: process.env.GBSHOW_SHOW_IMAGE_OUT,
  show_metadata_out: process.env.GBSHOW_SHOW_METADATA_OUT,
  file_limit: stringToNumber(process.env.GBSHOW_FILE_LIMIT),
  megabyte_limit: stringToNumber(process.env.GBSHOW_MEGABYTE_LIMIT),
  replace: stringToBoolean(process.env.GBSHOW_REPLACE),
  commit: stringToBoolean(process.env.GBSHOW_COMMIT),

  // non-options that can be configured
  api_cache_filename: process.env.GBSHOW_API_CACHE,
  api_cache_duration_ms: stringToNumber(process.env.GBSHOW_API_CACHE_MINUTES, 60000),
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
