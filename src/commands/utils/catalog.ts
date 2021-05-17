'use strict';

import { api, Video, VideoShow } from '../../api';

import { Context } from './context';

export type CatalogEpisode = Pick<Video, 'id'|'guid'|'associations'|'name'|'publish_date'>;
export interface CatalogSeason {
  name: string;
  episodes: CatalogEpisode[];
}
export interface CatalogSeasons {
  years: CatalogSeason[];
  games: CatalogSeason[];
}
export type CatalogSeasonType = keyof CatalogSeasons;
export interface Catalog {
  episodes: CatalogEpisode[];
  seasons: CatalogSeasons;
  preferredSeasons: CatalogSeasonType;
}

export interface CatalogSeasonReferenceOpts {
  show: VideoShow;
  season: number|string;
  catalog?: Catalog|void;
  seasonType?: CatalogSeasonType|void;
}

export interface CatalogEpisodeReferenceOpts {
  episode: number;
  show: VideoShow;
  catalog?: Catalog|void;
  season?: number|string|void;
  seasonType?: CatalogSeasonType|void;
}

export interface CatalogSeasonReference {
  seasonType: CatalogSeasonType;
  seasonNumber: number;
  seasonName: string;
  seasonCount: number;
  seasonEpisodeCount: number;
  showEpisodeCount: number;
}

export interface CatalogEpisodeReference extends CatalogSeasonReference {
  video: Video;
  seasonEpisodeNumber: number;
  showEpisodeNumber: number;
}

export async function create(show: VideoShow, context: Context): Promise<Catalog> {
  const { logger, copy_year } = context;
  const tag = `commands.utils.catalog.create`;

  if (!show.id) {
    throw new Error(`${tag}: show must have 'id' field; instead ${show}`);
  }

  // get all videos
  if (logger) logger.trace(`${tag}: retrieving all videos for show ${show.title} (${show.id})`);
  const videosData = await api.video.all({
    fields: ['id', 'guid', 'associations', 'name', 'publish_date'],
    filter: { field:'video_show', value:show.id },
    sort: { field:'publish_date', direction:'asc' }
  });
  const results = videosData.results || [];
  if (logger && !results.length) logger.warn(`${tag}: show ${show.title} (${show.id}) has no videos!`);

  const episodes: CatalogEpisode[] = [];
  const years: CatalogSeason[] = [];
  const games: CatalogSeason[] = [];

  // episodes
  for (const video of results) {
    const episode = video as CatalogEpisode;
    episodes.push(episode);
  }

  // year seasons
  let lastYear: CatalogSeason = { name:'__stub__', episodes:[] };
  let lastYearRegex = RegExp(lastYear.name, 'ig');
  for (const episode of episodes) {
    const year = (episode.publish_date || '1990').split('-')[0];
    if (year !== lastYear.name) {
      if (copy_year || !(episode.name || '').match(lastYearRegex)) {
        if (logger) logger.trace(`${tag}: starting ${year} year season for ${episode.name}`);
        lastYear = { name:year, episodes:[] };
        years.push(lastYear);
        lastYearRegex = RegExp(year, 'ig');
      } else {
        if (logger) logger.debug(`${tag}: including ${year} release in ${lastYear.name} season for ${episode.name}`);
      }
    }
    lastYear.episodes.push(episode);
  }

  // game seasons
  for (const episode of episodes) {
    const gameAssociation = (episode.associations || []).find(a => a.api_detail_url.includes('/game/'))
    const game = (gameAssociation && gameAssociation.name) || 'None';
    let lastGame = games.find(g => g.name === game);
    if (!lastGame) {
      lastGame = { name:game, episodes:[] };
      games.push(lastGame);
    }
    lastGame.episodes.push(episode);
  }

  // correct year season splits, e.g. for content that
  // belongs in December but had release dates spilling into January
  if (!copy_year) {
    for (let s = 1; s < years.length; s++) {
      const month = 1000 * 60 * 60 * 24 * 30;
      const lastYear = years[s - 1];
      const lastYearEpisodes = years[s - 1].episodes;
      const lastYearFinalMillis = new Date(`${lastYearEpisodes[lastYearEpisodes.length - 1].publish_date}Z`).getTime();

      // look for a break point
      const episodes = years[s].episodes;
      for (let e = 1; e < episodes.length; e++) {
        const lastEMillis = new Date(`${episodes[e - 1].publish_date}Z`).getTime();
        const eMillis = new Date(`${episodes[e].publish_date}Z`).getTime();
        const lastEDistance = lastEMillis - lastYearFinalMillis;
        const eDistance = eMillis - lastEMillis;
        if (lastEDistance < month && eDistance > month * 10.5) {
          if (logger) logger.debug(`${tag}: moving ${e} episodes from ${years[s].name} to ${lastYear.name}`);
          years[s - 1].episodes = years[s - 1].episodes.concat(years[s].episodes.slice(0, e));
          years[s].episodes = years[s].episodes.slice(e);
          break;
        }
      }
    }
  }

  // prefer "games" if an average of 3 __consecutive__ episodes per game, and
  // at least 2 games.
  const preferredSeasons = games.length > 1 && episodes.length / games.length >= 5 ? 'games' : 'years';

  logger.debug(`${tag}: show ${show.title} (${show.id}) has ${episodes.length} episodes, across ${years.length} years and ${games.length} games (${preferredSeasons} preferred)`);
  return  {
    episodes,
    seasons: {
      years,
      games,
    },
    preferredSeasons
  }
}

export async function findSeason(opts: CatalogSeasonReferenceOpts, context: Context): Promise<CatalogSeasonReference> {
  const { logger } = context;
  const tag = `commands.utils.catalog.findSeason`;

  const { show, season } = opts;
  const catalog = opts.catalog || await create(show, context);
  let seasonType = opts.seasonType || catalog.preferredSeasons;
  const origSeasonType = seasonType;

  let seasonNumber = -1;
  let catalogSeason: CatalogSeason|void = null;
  const regex = RegExp(`${season}`, 'ig');
  const seasonAsNumber = Number(season);
  if (!isNaN(seasonAsNumber)) {
    catalogSeason = catalog.seasons[seasonType][seasonAsNumber - 1];
    seasonNumber = seasonAsNumber;
    if (!catalogSeason) {
      seasonNumber = catalog.seasons['years'].findIndex(s => s.name.match(regex)) + 1;
      catalogSeason = catalog.seasons['years'][seasonNumber - 1];
      seasonType = 'years';
      if (logger) logger.trace(`${tag}: trying "years" seasons as a match for numeric season`);
    } else if (logger) logger.trace(`${tag}: trying season ${seasonAsNumber}th ${seasonType} season`);
    if (catalogSeason && logger) logger.debug(`${tag} found season ${seasonType} season ${seasonAsNumber}`);
  }
  if (!catalogSeason) {
    if (logger) logger.trace(`${tag}: checking for games season with name ${season}`);
    seasonNumber = catalog.seasons['games'].findIndex(s => s.name.match(regex)) + 1;
    catalogSeason = catalog.seasons['games'][seasonNumber - 1];
    seasonType = 'games';
    if (logger) logger.trace(`${tag}: trying "games" seasons as a match for ${season}`);
  }

  if (!catalogSeason) {
    throw new Error(`${tag} no match found for ${origSeasonType} season ${season}`);
  }

  return {
    seasonType,
    seasonNumber,
    seasonName: catalogSeason.name,
    seasonCount: catalog.seasons[seasonType].length,
    seasonEpisodeCount: catalogSeason.episodes.length,
    showEpisodeCount: catalog.episodes.length
  }
}

export async function findEpisode(opts: CatalogEpisodeReferenceOpts, context: Context): Promise<CatalogEpisodeReference> {
  const { logger } = context;
  const tag = `commands.utils.catalog.findEpisode`;

  const { episode, show, season } = opts;
  const catalog = opts.catalog || await create(show, context);
  let seasonType = opts.seasonType || catalog.preferredSeasons;
  const origSeasonType = seasonType;

  let video: Video|void = null;
  let seasons: CatalogSeason[]|void = null;

  if (!season) {
    const guid = catalog.episodes[episode - 1].guid;
    video = await api.video.get(guid);
    seasons = catalog.seasons[seasonType];
    if (logger) logger.debug(`${tag}: found video ${video.name} as show episode ${episode}`);
  } else {
    const regex = RegExp(`${season}`, 'ig');
    const seasonNumber = Number(season);
    if (!isNaN(seasonNumber)) {
      let seasonObj = catalog.seasons[seasonType][seasonNumber - 1];
      if (!seasonObj) {
        seasonObj = catalog.seasons['years'].find(s => s.name.match(regex));
        seasonType = 'years';
        if (logger) logger.trace(`${tag}: trying "years" seasons as a match for numeric season`);
      } else if (logger) logger.trace(`${tag}: trying season ${seasonNumber}th ${seasonType} season`);

      if (seasonObj && episode <= seasonObj.episodes.length) {
        video = await api.video.get(seasonObj.episodes[episode - 1].guid);
        seasons = catalog.seasons[seasonType];
        if (logger) logger.debug(`${tag}: found video ${video.name} as ${seasonType} season ${seasonNumber} episode ${episode}`);
      }
    }
    if (!video) {
      if (logger) logger.trace(`${tag}: checking for games season with name ${season}`);
      const seasonObj = catalog.seasons['games'].find(s => s.name.match(regex));
      if (seasonObj && episode <= seasonObj.episodes.length) {
        video = await api.video.get(seasonObj.episodes[episode - 1].guid);
        seasons = catalog.seasons[seasonType];
        seasonType = 'games';
        if (logger) logger.debug(`${tag}: found video ${video.name} as ${seasonType} season ${season} episode ${episode}`);
      }
    }
  }

  if (!video || !seasons) {
    throw new Error(`${tag} no match found for ${origSeasonType} season ${season} episode ${episode}`);
  }
  const guid = video.guid;

  const seasonNumber = seasons.findIndex(s => s.episodes.some(e => e.guid === guid)) + 1;
  if (!seasonNumber) {
    throw new Error(`${tag} no season number for episode ${guid}`);
  }

  return {
    video,
    seasonType,
    seasonNumber,
    seasonName: seasons[seasonNumber - 1].name,
    seasonEpisodeNumber: seasons[seasonNumber - 1].episodes.findIndex(e => e.guid === guid) + 1,
    showEpisodeNumber: catalog.episodes.findIndex(e => e.guid === guid) + 1,
    seasonEpisodeCount: seasons[seasonNumber - 1].episodes.length,
    showEpisodeCount: catalog.episodes.length,
    seasonCount: seasons.length
  }
}

export const catalog = {
  create,
  findSeason,
  findEpisode
}

export default catalog;
