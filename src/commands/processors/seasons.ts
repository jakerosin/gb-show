'use strict';

//  internal
import Parser from '../utils/parser';
import sharedOptions from '../utils/options';
import { ERROR } from '../utils/context';

import { api, VideoShow, ListResult } from '../../api';
import { shows } from '../utils/shows';
import { catalog } from '../utils/catalog';

// types
import { Context } from '../utils/context';

export const aliases = ['seasons', 'show', 'examine', 'episodes', 'list'];
export const summary = 'Load and display season information about the indicated show';

export const parser = new Parser({
  title: 'Seasons',
  description: 'Loads and display season information about the indicated show',
  aliases,
  synopsis: [
    'seasons "Quick Look"',
    'seasons Endurance',
    'seasons playdate --season-type games'
  ],
  options: [
    { ...sharedOptions.show, defaultOption:true },
    sharedOptions.season_type,
    sharedOptions.details,
  ]
});

export async function process(argv: string[], context: Context): Promise<number> {
  const { logger } = context;

  const options =  parser.process(argv, logger);
  if (!options) return ERROR.NONE;

  const { show, details } = options;

  if (!show) throw new Error(`Must specify a show. IDs or partial names are acceptable, e.g. "4" or "Endurance"`);

  const matches = await shows.list(show, context);
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
