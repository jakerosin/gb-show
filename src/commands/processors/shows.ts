'use strict';

//  internal
import Parser from '../utils/parser';
import sharedOptions from '../utils/options';
import { ERROR } from '../utils/context';

import { api, VideoShow, ListResult } from '../../api';
import * as shows from '../utils/shows';

// types
import { Context } from '../utils/context';

export const aliases = ['shows', 'channels'];
export const summary = 'Load and display all GB show names';

export const parser = new Parser({
  title: 'Shows',
  description: 'Loads and displays all GB show names',
  aliases,
  synopsis: [
    'shows',
    'shows Matrix'
  ],
  options: [
    { ...sharedOptions.show, defaultOption:true },
  ]
});

export async function process(argv: string[], context: Context): Promise<number> {
  const { logger } = context;

  const options =  parser.process(argv, logger);
  if (!options) return ERROR.NONE;

  const { show } = options;

  let showList: VideoShow[] = [];
  if (show) {
    const matches = await shows.list(show, context);
    showList = matches.map(m => m.show);
  } else {
    showList = (await api.videoShow.all({
      fields: ['title', 'id', 'guid']
    })).results || [];
  }

  if (!showList.length) {
    logger.error(`No shows found`);
    return ERROR.UNKNOWN_SHOW;
  }

  for (const show of showList) {
    logger.in('blue').print(`${show.title} (id: ${show.id})`);
  }

  return ERROR.NONE;
}
