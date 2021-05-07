'use strict';

// internal
import { Context, Command, ERROR } from './utils/context';

const cmds: Command[] = [];

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
  // TODO

  // special commands
  // TODO

  // universal processor
  process
};
