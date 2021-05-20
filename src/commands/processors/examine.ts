'use strict';

//  internal
import Parser from '../utils/parser';
import sharedOptions from '../utils/options';
import { ERROR } from '../utils/context';

import { api, VideoShow, ListResult, ListFieldFilter } from '../../api';
import { shows } from '../utils/shows';
import { catalog } from '../utils/catalog';

// types
import { Context } from '../utils/context';

export const aliases = ['examine', 'seasons', 'episodes'];
export const summary = 'Load and display season information about the indicated show';

export const parser = new Parser({
  title: 'Examine',
  description: `
  Generate and print a season structure for the indicated show, which will be
  based on either year of release or the game associated with each episode.

  The season type -- "years" or "games" -- will be inferred based on the overall
  video release structure, but can optionally be specified with "--season-type <type>".

  Because generating a season structure requires examination of every video released
  for the show, this feature makes multiple Giant Bomb API calls and for long-running
  shows may take a noticeable amount of time before displaying results (API calls
  are rate-limited to 1 second per call).
  `,
  aliases,
  synopsis: [
    'examine "Quick Look"',
    'examine Endurance',
    'examine playdate --season-type games'
  ],
  options: [
    { ...sharedOptions.show, defaultOption:true },
    sharedOptions.season_type,
    sharedOptions.details,
    sharedOptions.premium,
    sharedOptions.free
  ]
});

export async function process(argv: string[], context: Context): Promise<number> {
  const { logger } = context;

  const options =  parser.process(argv, logger);
  if (!options) return ERROR.NONE;

  const { show, details, premium, free } = options;

  if (!show) {
    logger.print(parser.help());
    logger.in('red').print(`Must specify a show. IDs or partial names are acceptable, e.g. "4" or "Endurance"`);
    throw new Error(`seasons: must specify a show`);
  }

  if (premium && free) {
    throw new Error(`Can't combine --premium and --free; nothing will match`);
  }

  const filter: ListFieldFilter[] = [];
  if (premium) filter.push({ field:'premium', value:'true' });
  if (free) filter.push({ field:'premium', value:'false' });

  const matches = await shows.list({ query:show, filter }, context);
  if (details && matches.length > 1) {
    logger.print(`Found ${matches.length} possible matches for "${show}":`);
    matches.forEach((match, index) => {
      let color = '';
      if (match.matchType === 'id') color = 'bright';
      if (match.matchType === 'title') color = 'bright';
      if (match.matchType === 'video') color = 'black';
      if (match.matchType === 'association') color = 'dim';

      logger.in(color).print(`  ${match.show.title}  (id: ${match.show.id})`);
    });
    logger.print();
  } else if (!matches.length) {
    logger.in('red').print(`No shows found for "${show}"`);
    return ERROR.UNKNOWN_SHOW;
  }

  const showDetails = matches[0].show;
  const showCatalog = await catalog.create(showDetails, context);
  const season_type = options['season-type'] || showCatalog.preferredSeasons;
  const seasons = showCatalog.seasons[season_type];
  const recommendedSeasons = showCatalog.seasons[showCatalog.preferredSeasons];

  logger.in('bright', 'blue').print(`${showDetails.title} (id: ${showDetails.id}) - ${showCatalog.episodes.length} videos. Recommended season type: ${showCatalog.preferredSeasons} (${recommendedSeasons.length} seasons)`);
  seasons.forEach((season, index) => {
    const number = `${index + 1}`.padStart(2, '0');
    const firstDate = new Date(`${season.episodes[0].publish_date}Z`);
    const firstDay = firstDate.toISOString().replace(/T/, ' ').replace(/\..+/, '').split(' ')[0];
    const lastDate = new Date(`${season.episodes[season.episodes.length - 1].publish_date}Z`);
    const lastDay = lastDate.toISOString().replace(/T/, ' ').replace(/\..+/, '').split(' ')[0];
    const publish_range = `${firstDay} - ${lastDay}`;
    const episode_count = `${season.episodes.length} episodes`;
    logger.in('blue').print(`  Season ${number} - ${season.name}`)
    logger.in('dim').print(`    ${season.episodes.length} episodes  (${publish_range})`);
    if (details) {
      season.episodes.forEach((episode, epIndex) => {
        const epNumber = `${epIndex + 1}`.padStart(2, '0');
        logger.in('dim').print(`      Episode ${epNumber} (${episode.publish_date}) - ${episode.name}`);
      });
    }
  });
  logger.print();

  return ERROR.NONE;
}
