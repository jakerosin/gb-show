'use strict'

import Parser from './commands/utils/parser';
import { ERROR, DEFAULT } from './commands/utils/context';
import Logger from './utils/logger';

import api from './api';
import commands from './commands';

// types
import Cache from  './api/cache';
import { Context } from './commands/utils/context';

export default async function run(dir): Promise<number> {
  const commandWords = (Object.values(commands) as any[]).filter(c => c.aliases && c.summary);
  const commandSummaries = commandWords.map(c => {
    return { name:c.aliases[0], summary:c.summary }
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

  const parser = new Parser({
    title: 'gb-show',
    description: `
      A CLI for downloading and organizing Giant Bomb videos (e.g. for archival,
        Plex, etc.). Save video files, thumbnails, and associated metadata into
        custom file structures using templated output paths.

      Primarily designed for medium-scale batch downloads of shows organized into
        an inferred season-based structure. To download just a few of your
        favorite videos, or the most recent releases, try www.giantbomb.com or
        other tools such as "gb-dl" (github.com/lightpohl/gb-dl)

      Don't distribute copyrighted content. Always stay within the Giant Bomb
        API usage guidelines, and don't download more than 100 videos per day.
        Due to API rate limiting, some commands may take a noticeably long time
        to complete, especially when constructing a show's season structure.
    `,
    synopsis: [
      'gb-show <options> [command <options>]',
      'gb-show list',
      'gb-show find <show>',
      'gb-show seasons <show>',
      'gb-show download <show>'
    ],
    options: [
      {
        name: 'api-key', alias: 'k', type: String, defaultValue: DEFAULT.api_key,
        description: 'API key for giantbomb.com (default: GIANTBOMB_TOKEN env variable)'
      },
      {
        name: 'log-level', alias: 'l', type: String, defaultValue: DEFAULT.log_level,
        description: 'Severity level for logging: one of [off, silent, fatal, error, warn, info, debug, trace, all]'
      },
      {
        name: 'no-color', alias: 'c', type: Boolean, defaultValue: DEFAULT.no_color,
        description: 'Do not color log and console output for clarity'
      },
      {
        name: 'copy-year', alias  : 'y', type: Boolean, defaultValue: false,
        description: 'Naively copy publication year for Season ordering (do not correct for videos released in early January)'
      },
      {
        name: 'command', type: String, defaultOption: true,
        description: 'The command to execute; see Command List'
      }
    ],
    misc: [
      {
        header: 'Command List',
        content: commandSummaries
      }
    ],
    footer: 'For information on a specific command, use "gb-show [command] help"'
  });

  const mainOptions = parser.process(null);
  if (!mainOptions) return ERROR.NONE;

  const argv = mainOptions._unknown || [];

  // parse and normalize options
  const logger = new Logger({
    level:mainOptions['log-level'],
    color:!mainOptions['no-color'] }
  );

  if (!mainOptions.command) {
    logger.print(parser.help());
    logger.in('red').print(`Must specify a command, e.g. "gb-show help" or "gb-show list"`);
    throw new Error(`No command specified`);
  }
  const command = mainOptions.command.toLowerCase();

  const context: Context = {
    logger,
    api_key: mainOptions['api-key'],
    copy_year: mainOptions['copy-year']
  };

  if (!context.api_key) {
    logger.error(`Must specify --api_key or set GIANTBOMB_TOKEN env variable`);
    return ERROR.NO_TOKEN;
  }

  // prepare API
  const apiCache = await Cache.loaded({
    filename: DEFAULT.api_cache_filename || './gb-show.cache.json',
    cache_duration_ms: DEFAULT.api_cache_duration_ms,
    logger
  });
  api.setApiKey(context.api_key);
  api.setLogger(logger);
  api.setCache(apiCache);

  try {
    const result = await commands.process(command, argv, context);
    if (result) logger.in('red').error(`Command ${command} completed, but reported an error: ${result}`);
    return result;
  } finally {
    await apiCache.flush();
  }
}

run(__dirname).then(a => process.exit(a));
