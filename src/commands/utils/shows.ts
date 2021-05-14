'use strict';

import { api, Video, VideoShow } from '../../api';

import { Context } from './context';

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

function onlyNonNullUnique(value, index, self) {
  return value !== void 0 && self.indexOf(value) === index;
}

export type VideoShowMatchType = 'id'|'title'|'video'|'association';

export interface VideoShowMatch {
  show: VideoShow;
  matchType: VideoShowMatchType;
};

export type VideoShowEpisode = Pick<Video, 'id'|'guid'|'associations'|'name'|'publish_date'>;
export interface VideoShowSeason {
  name: string;
  episodes: VideoShowEpisode[];
}
export interface VideoShowSeasons {
  years: VideoShowSeason[];
  games: VideoShowSeason[];
}
export type VideoShowPreferredSeasons = keyof VideoShowSeasons;
export interface VideoShowEpisodes {
  episodes: VideoShowEpisode[];
  seasons: VideoShowSeasons;
  preferredSeasons: VideoShowPreferredSeasons;
}

/**
 * Finds (if possible) the indicated show based on its id, guid,
 * or (partial) name. "Name" is an ambiguous match; the first such match
 * is provided, although the ambiguity is logged.
 */
export async function find(ident: string|number, context: Context): Promise<VideoShowMatch|void> {
  const { logger } = context;
  const tag = `command.utils.shows.find`;

  // Treat as an ID
  if (api.isID(ident)) {
    const data = await api.videoShow.list({ filter:{ field:'id', value:ident } });
    if (data.results && data.results.length) {
      const show = data.results[0];
      if (logger) logger.debug(`${tag}: ident ${ident} is an ID; found ${show.title} (${show.guid})`);
      return { show, matchType:'id' };
    } else {
      if (logger) logger.debug(`${tag}: ident ${ident} is a number, but no show found with that ID`);
      return null;
    }
  } else if (logger) {
    logger.trace(`${tag}: ident ${ident} is not an ID`);
  }

  // Treat as a GUID
  if (api.isGUID(ident)) {
    try {
      const show = await api.videoShow.get(`${ident}`.trim());
      if (logger) logger.debug(`${tag}: ident ${ident} is a guid; found ${show.title} (${show.guid})`);
      return { show, matchType:'id' };
    } catch (err) {
      if (logger) logger.debug(`${tag}: ident ${ident} was not found as a GUID`);
    }
  } else if (logger) {
    logger.trace(`${tag}: ident ${ident} is not a GUID`);
  }

  // Treat as a partial show title (matches are possible!)
  // Note that filtering by `title` fails on the API side, so instead
  // we fetch all shows (currently only 89) and match locally with regex
  const data = await api.videoShow.all({ fields:['title', 'id', 'guid'] });
  if (data.results && data.results.length) {
    const regex = new RegExp(`${ident}`, 'ig');
    const matches = data.results.filter(a => (a.title || '').match(regex));
    if (matches.length > 1 && logger) {
      logger.warn(`${tag}: ident ${ident} is ambiguous: at least ${matches.length} shows match, e.g.`);
      for (let i = 0; i < 5 && i < matches.length; i++) {
        logger.warn(`${tag}:   ${matches[i].title} (${matches[i].guid})`)
      }
    }

    if (matches.length) {
      const show = await api.videoShow.get(`${matches[0].guid}`);
      if (logger) logger.debug(`${tag}: ident ${ident} is a name; found ${show.title} (${show.guid})`);
      return { show, matchType:'title' }
    }
  }

  // look for videos with this in their name or as an association
  const searchTypes: VideoShowMatchType[] = ['video', 'association'];
  for (const matchType of searchTypes) {
    const fields = ['name', 'video_show', 'id'];
    const videosData = matchType === 'video'
      ? await api.video.list({ filter:{ field:'name', value:`${ident}` }, fields })
      : await api.video.search(`${ident}`, { fields });
    if (videosData.results && videosData.results.length) {
      const titleForId: any = {};
      const show_ids = videosData.results.sort((a, b) => a.id - b.id)
        .map(a => {
          if (a.video_show) {
            titleForId[a.video_show.id] =  a.video_show.title;
            return a.video_show.id;
          }
        }).filter(onlyNonNullUnique);

      if (logger) {
        if (show_ids.length > 1) {
          logger.warn(`${tag}: ident ${ident} matches at least ${show_ids.length} shows, e.g.`);
          for (let i = 0; i < 5 && i < show_ids.length; i++) {
            const id = show_ids[i];
            logger.warn(`${tag}:   ${titleForId[id]}`)
          }
        } else if (videosData.number_of_page_results < videosData.number_of_total_results) {
          logger.warn(`${tag}: ident ${ident} matches ${videosData.number_of_total_results} ${matchType}s and may match multiple shows`)
        }
      }

      const showData = await api.videoShow.list({ filter:{ field:'id', value:show_ids[0] } });
      if (data.results && data.results.length) {
        const show = showData.results[0];
        if (logger) logger.debug(`${tag}: ident ${ident} found as ${matchType}; belongs to ${show.title} (${show.guid})`);
        return { show: show as VideoShow, matchType }
      } else {
        if (logger) logger.error(`${tag}: ident ${ident} found as ${matchType}, but couldn't retrieve video`);
        return null;
      }
    }
  }
}

/**
 * Lists (if possible) ALL related shows based on id, guid,
 * or (partial) name. Matches are ordered based on strength, with video-based
 * associations being weakest.
 */
export async function list(ident: string|number, context: Context): Promise<VideoShowMatch[]> {
  const { logger } = context;
  const tag = `command.utils.shows.list`;

  const showIDs = new Set<number>();
  const shows: VideoShowMatch[] = [];

  // Treat as an ID
  if (api.isID(ident)) {
    const data = await api.videoShow.list({ filter:{ field:'id', value:ident } });
    if (data.results && data.results.length) {
      const show = data.results[0];
      showIDs.add(show.id);
      shows.push({ show, matchType:'id' });
      if (logger) logger.debug(`${tag}: ident ${ident} is an ID; found ${show.title} (${show.guid})`);
    }
  } else if (logger) {
    logger.trace(`${tag}: ident ${ident} is not an ID`);
  }

  // Treat as a GUID
  if (api.isGUID(ident)) {
    try {
      const show = await api.videoShow.get(`${ident}`.trim());
      if (!showIDs.has(show.id)) {
        showIDs.add(show.id);
        shows.push({ show, matchType:'id' });
        if (logger) logger.debug(`${tag}: ident ${ident} is a guid; found ${show.title} (${show.guid})`);
      }
    } catch (err) {
      if (logger) logger.debug(`${tag}: ident ${ident} was not found as a GUID`);
    }
  } else if (logger) {
    logger.trace(`${tag}: ident ${ident} is not a GUID`);
  }

  // Treat as a partial show title (matches are possible!)
  // Note that filtering by `title` fails on the API side, so instead
  // we fetch all shows (currently only 89) and match locally with regex
  const data = await api.videoShow.all({ fields:['title', 'id', 'guid'] });
  if (data.results && data.results.length) {
    const regex = new RegExp(`${ident}`, 'ig');
    const matches = data.results.filter(a => (a.title || '').match(regex));
    for (const match of matches) {
      if (!showIDs.has(match.id)) {
        const show = await api.videoShow.get(match.guid);
        showIDs.add(show.id);
        shows.push({ show, matchType:'title' });
        if (logger) logger.debug(`${tag}: ident ${ident} matched to title ${show.title} (${show.guid})`);
      }
    }
  }

  // the best we can do is find a show FEATURING this text; search doesn't exist
  // for shows, so the best we do is a search for videos.
  const searchTypes: VideoShowMatchType[] = ['video', 'association'];
  for (const matchType of searchTypes) {
    const fields = ['name', 'video_show', 'id'];
    const videosData = matchType === 'video'
      ? await api.video.list({ filter:{ field:'name', value:`${ident}` }, fields })
      : await api.video.search(`${ident}`, { fields });

    if (videosData.results && videosData.results.length) {
      const titleForId: any = {};
      const show_ids = videosData.results.sort((a, b) => a.id - b.id)
        .map(a => {
          if (a.video_show) {
            titleForId[a.video_show.id] =  a.video_show.title;
            return a.video_show.id;
          }
        }).filter(onlyNonNullUnique);

      if (logger && !showIDs.size && videosData.number_of_page_results < videosData.number_of_total_results) {
        logger.warn(`${tag}: ident ${ident} matches ${videosData.number_of_total_results} ${matchType}s and may match additional shows`)
      }

      for (const show_id of show_ids) {
        if (!showIDs.has(show_id)) {
          const showData = await api.videoShow.list({ filter:{ field:'id', value:show_id } });
          if (data.results && data.results.length) {
            const show = showData.results[0];
            showIDs.add(show.id);
            shows.push({ show: show as VideoShow, matchType });
            if (logger) logger.debug(`${tag}: ident ${ident} found in a ${matchType} search; belongs to ${show.title} (${show.guid})`);
          }
        }
      }
    }
  }

  return shows;
}

export async function episodes(show: VideoShow, context: Context): Promise<VideoShowEpisodes> {
  const { logger, copy_year } = context;
  const tag = `command.utils.shows.episodes`;

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

  const episodes: VideoShowEpisode[] = [];
  const years: VideoShowSeason[] = [];
  const games: VideoShowSeason[] = [];
  let lastYear: VideoShowSeason = { name:'__stub__', episodes:[] };
  let lastYearRegex = RegExp(lastYear.name, 'ig');

  // episodes
  for (const video of results) {
    const episode = video as VideoShowEpisode;
    episodes.push(episode);
  }

  // year seasons
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

export const shows = {
  find,
  list,
  episodes
}

export default shows;
