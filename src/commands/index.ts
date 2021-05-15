'use strict';

// internal
import { ERROR } from './utils/context';

// command processors
import * as download from './processors/download';
import * as seasons from './processors/seasons';
import * as shows from './processors/shows';

// types
import { Context, Command } from './utils/context';

const cmds: Command[] = [download, seasons, shows];

const process = async(command:string, argv: string[], context: Context): Promise<number> => {
  const { logger } = context;

  try {
    /*
    if (batch.aliases.includes(command)) {
      return await batch.process(argv, context, cmds);
    }
    */

    for (const cmd of cmds) {
      if (cmd.aliases.includes(command)) {
        return await cmd.process(argv, context);
      }
    }
  } catch (err) {
    logger.print(`ERROR: ${err.message}`, 'bright', 'red');
    throw err;
  }

  logger.print(`ERROR: Unrecognized command '${command}'`, 'bright', 'red')
  return ERROR.UNKNOWN_COMMAND;
}

export default {
  // processors
  download,
  seasons,
  shows,

  // special commands
  // TODO

  // universal processor
  process
};
