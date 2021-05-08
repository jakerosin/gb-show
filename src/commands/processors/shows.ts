'use strict';

//  internal
import Parser from '../utils/parser';
import { ERROR } from '../utils/context';

import { api, VideoShow, ListResult } from '../../api';

// types
import { Context } from '../utils/context';

export const aliases = ['shows', 'channels'];
export const summary = 'Load and display all GB show names';

export const parser = new Parser({
  title: 'Shows',
  description: 'Loads and displays all GB show names',
  aliases,
  synopsis: ['shows'],
  options: []
});

export async function process(argv: string[], context: Context): Promise<number> {
  const { logger } = context;

  const options =  parser.process(argv, logger);
  if (!options) return ERROR.NONE;

  const { results } = await api.videoShow.all({
    fields: ['title', 'id', 'guid']
  });
  if (!results) {
    logger.error(`No shows found`);
    return ERROR.WHAT;
  }

  for (const show of results) {
    logger.in('blue').log(`${show.id}: ${show.title}`);
  }

  return ERROR.NONE;
}
