'use strict';

//  internal
import Parser from '../utils/parser';
import sharedOptions from '../utils/options';
import { ERROR } from '../utils/context';

import { api, VideoShow, ListResult, ListFieldFilter } from '../../api';
import { shows, VideoShowMatch } from '../utils/shows';

// types
import { Context } from '../utils/context';

export const aliases = ['list', 'shows', 'find', 'search'];
export const summary = 'Load and display GB show names';

export const parser = new Parser({
  title: 'List',
  description: `
  Load and print the Giant Bomb show names. If a search term is provided, only
  shows related to that term will be displayed, in the order of significance;
  for example shows with that term in their title, then shows with videos
  related to that term, etc.
  `,
  aliases,
  synopsis: [
    'list',
    'list Matrix',
    'list "Endurance Run"',
    'list Ben',
    'list [query]'
  ],
  options: [
    { ...sharedOptions.show, defaultOption:true },
    sharedOptions.premium,
    sharedOptions.free,
    sharedOptions.details
  ]
});

export async function process(argv: string[], context: Context): Promise<number> {
  const { logger } = context;

  const options =  parser.process(argv, logger);
  if (!options) return ERROR.NONE;

  const { show, premium, free, details } = options;
  if (premium && free) {
    throw new Error(`Can't combine --premium and --free; nothing will match`);
  }

  const filter: ListFieldFilter[] = [];
  if (premium) filter.push({ field:'premium', value:'true' });
  if (free) filter.push({ field:'premium', value:'false' });

  let matches: VideoShowMatch[] = [];
  if (show) {
    matches = await shows.list({ query:show, filter }, context);
  } else {
    const showList = (await api.videoShow.all({
      fields: ['title', 'id', 'guid', 'premium', 'active'],
      filter
    })).results || [];
    for (const videoShow of showList) {
      matches.push({ show:videoShow, matchType:'title' });
    }
  }

  if (!matches.length) {
    logger.error(`No shows found`);
    return ERROR.UNKNOWN_SHOW;
  }

  let firstMatchType = matches[0].matchType;

  matches.forEach((match, index) => {
    const s = match.show;
    const color = !index ? ['bright', 'blue']
      : match.matchType === firstMatchType ? ['blue'] : [];
    let text = `${s.title} (id: ${s.id})`;
    if (details) {
      const t = [];
      if (s.premium) t.push('Premium');
      if (s.active) t.push('Active');
      if (t.length) text = text + ` [${t.join(', ')}]`;
    }
    logger.in(...color).print(text);
  })

  return ERROR.NONE;
}
