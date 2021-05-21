'use strict';

//  internal
import Parser from '../utils/parser';
import sharedOptions from '../utils/options';
import { ERROR } from '../utils/context';

import { api, Video, ListResult, ListFieldFilter } from '../../api';
import { videos, VideoMatch } from '../utils/videos';

// types
import { Context } from '../utils/context';

export const aliases = ['videos', 'v'];
export const summary = 'Load and display GB show names';

export const parser = new Parser({
  title: 'Videos',
  description: `
  Queries and displays Giant Bomb video names. gb-show is designed primarily to
  download those videos organized into shows, but a lot of video content is not,
  including videos that naturally fall into a series (How to Build a Bomb,
  Backflips 'n Bioforge, etc.)
  `,
  aliases,
  synopsis: [
    'videos bioforge',
    'videos "build a bomb"',
    'videos Mario',
    'videos Ben'
  ],
  options: [
    { ...sharedOptions.video, defaultOption:true },
    sharedOptions.premium,
    sharedOptions.free,
    sharedOptions.details
  ]
});

export async function process(argv: string[], context: Context): Promise<number> {
  const { logger } = context;

  const options =  parser.process(argv, logger);
  if (!options) return ERROR.NONE;

  const { video, premium, free, details } = options;
  if (!video) {
    logger.print(parser.help());
    logger.in('red').print(`Must specify a search term. IDs or partial names are acceptable, e.g. "4" or "Mario"`);
    throw new Error(`videos: must specify a search term`);
  }

  if (premium && free) {
    throw new Error(`Can't combine --premium and --free; nothing will match`);
  }

  const filter: ListFieldFilter[] = [];
  if (premium) filter.push({ field:'premium', value:'true' });
  if (free) filter.push({ field:'premium', value:'false' });

  const matches = await videos.list({ query:video, filter }, context);
  if (!matches.length) {
    logger.error(`No videos found`);
    return ERROR.UNKNOWN_VIDEO;
  }
  let firstMatch = matches[0];

  if (!details) {
    matches.forEach((match, index) => {
      const v = match.video;
      const color = !index ? ['bright', 'blue']
        : match.matchType === firstMatch.matchType ? ['blue'] : [];
      logger.in(...color).print(`${v.name} (id: ${v.id})`);
    });
  } else {
    interface ShowMatches {
      show_id: number|void;
      matches: VideoMatch[];
    }
    const showMatches: ShowMatches[] = [];
    matches.forEach(match => {
      let show_id = match.video.video_show ? match.video.video_show.id : null;
      let sm = showMatches.find(arr => arr.show_id === show_id);
      if (!sm) {
        sm = { show_id, matches:[] };
        showMatches.push(sm);
      }
      sm.matches.push(match);
    });

    showMatches.forEach((sm, smIndex) => {
      const show = sm.matches[0].video.video_show;
      sm.matches.forEach((match, index) => {
        const v = match.video;
        const color = !index && !smIndex ? ['bright', 'blue']
          : match.matchType === firstMatch.matchType ? ['blue'] : [];
        let text = `${v.name} (id: ${v.id})`;
        if (details) {
          const dateObj = new Date(`${v.publish_date}Z`);
          const date = dateObj.toISOString().replace(/T/, ' ').replace(/\..+/, '').split(' ')[0];
          text = text + ` ${date}`;
          const t = [];
          if (v.premium) t.push('Premium');
          if (t.length) text = text + ` [${t.join(', ')}]`;
        }
        logger.in(...color).print(text);
      });
      if (show) logger.in('dim').print(`  ${show.title} (id: ${show.id})`);
      logger.print();
    });

    matches.forEach((match, index) => {

    });
  }

  return ERROR.NONE;
}
