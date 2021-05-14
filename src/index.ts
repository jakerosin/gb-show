'use strict'

import Parser from './commands/utils/parser';
import { ERROR } from './commands/utils/context';
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
    title: 'GB Tool',
    description: 'A tool for finding and archiving Giant Bomb videos (e.g. for Plex)',
    synopsis: [
      'gb-tool <options> [command <options>]'
    ],
    options: [
      {
        name: 'log-level', alias: 'l', type: String, defaultValue: 'info',
        description: 'Severity level for logging: one of [off, silent, fatal, error, warn, info, debug, trace, all]'
      },
      {
        name: 'api-key', alias: 'k', type: String,
        description: 'API key for giantbomb.com (default: GIANTBOMB_TOKEN env variable)'
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
    footer: 'For information on a specific command, use "gb-tool [command] help"'
  });

  const mainOptions = parser.process(null);
  if (!mainOptions) return ERROR.NONE;

  const argv = mainOptions._unknown || [];

  // parse and normalize options
  const logger = new Logger({ level:mainOptions['log-level'] });

  const command = mainOptions.command.toLowerCase();

  const context: Context = {
    logger,
    api_key: argv['api-key'] || process.env.GIANTBOMB_TOKEN
  };

  if (!context.api_key) {
    logger.error(`Must specify --api_key or set GIANTBOMB_TOKEN env variable`);
    return ERROR.NO_TOKEN;
  }

  // prepare API
  const apiCache = await Cache.loaded({ filename: './gb-tool.cache.json', logger });
  api.setApiKey(context.api_key);
  api.setLogger(logger);
  api.setCache(apiCache);

  const result = await commands.process(command, argv, context);

  // force write the cache
  await apiCache.flush();
}

module.exports = exports = run;
