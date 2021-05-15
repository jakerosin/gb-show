'use strict';

import { api, Video, VideoShow } from '../../api';
import { shows, VideoShowEpisodes, VideoShowSeason } from './shows';

import { Context } from './context';

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

function onlyNonNullUnique(value, index, self) {
  return value !== void 0 && self.indexOf(value) === index;
}

export type VideoMatchType = 'id'|'name'|'association';

export interface VideoMatch {
  video: Video;
  matchType: VideoMatchType;
};

export interface VideoEpisodeOpts {
  episode: number;
  show: VideoShow;
  episodes?: VideoShowEpisodes|void;
  season?: number|string|void;
  seasonType?: string|void;
}

export interface VideoEpisodeMatch {
  video: Video;
  seasonType: string;
  seasonNumber: number;
  seasonName: string;
  seasonEpisodeNumber: number;
  showEpisodeNumber: number;
  seasonEpisodeCount: number;
  showEpisodeCount: number;
  seasonCount: number;
}

/**
 * Finds (if possible) the indicated show based on its id, guid,
 * or (partial) name. "Name" is an ambiguous match; the first such match
 * is provided, although the ambiguity is logged.
 */
export async function find(ident: string|number, show: VideoShow|void, context: Context): Promise<VideoMatch|void> {
  const { logger } = context;
  const tag = `commands.utils.videos.find`;

  const showFilter = show ? { field:'video_show', value:show.id } : null;

  // Treat as an ID
  if (api.isID(ident)) {
    const filter = [{ field:'id', value:ident }];
    if (showFilter) filter.push(showFilter);
    const data = await api.video.list({ filter });
    if (data.results && data.results.length) {
      const video = data.results[0];
      if (logger) logger.debug(`${tag}: ident ${ident} is an ID; found ${video.name} (${video.guid})`);
      return { video, matchType:'id' };
    } else if (!show) {
      if (logger) logger.debug(`${tag}: ident ${ident} is a number, but no video found with that ID`);
      return null;
    }
  } else if (logger) {
    logger.trace(`${tag}: ident ${ident} is not an ID`);
  }

  // Treat as a GUID
  if (api.isGUID(ident)) {
    try {
      const video = await api.video.get(`${ident}`.trim());
      if (show && (!video.video_show || video.video_show.id !== show.id)) throw new Error(`Wrong show`);
      if (logger) logger.debug(`${tag}: ident ${ident} is a guid; found ${video.name} (${video.guid})`);
      return { video, matchType:'id' };
    } catch (err) {
      if (logger) logger.debug(`${tag}: ident ${ident} was not found as a GUID`);
    }
  } else if (logger) {
    logger.trace(`${tag}: ident ${ident} is not a GUID`);
  }

  if (show) {
    // download all episodes; see if one fits
    const { results } = await api.video.all({
      fields: ['id', 'guid', 'associations', 'name', 'publish_date'],
      filter: { field:'video_show', value:show.id },
      sort: { field:'publish_date', direction:'asc' }
    });
    const regex = RegExp(`${ident}`, 'ig');
    let matchType: VideoMatchType = 'name';
    let matches = (results || []).filter(v => (v.name||'').match(regex));
    if (!matches.length) {
      matches = (results || []).filter(v => (v.associations || []).find(a => a.api_detail_url.includes('/game/') && (a.name||'').match(regex)));
      matchType = 'association';
    }
    if (matches.length) {
      if (logger && matches.length > 1) {
        logger.warn(`${tag}: ident ${ident} matches at least ${matches.length} ${matchType}s`);
        for (let i = 0; i < 5 && i < matches.length; i++) {
          logger.warn(`${tag}:   ${ matches[i].name}`)
        }
      }
      const video = await api.video.get(matches[0].guid);
      return { video, matchType };
    }
  } else {
    // look for videos with this in their name or as an association
    const searchTypes: VideoMatchType[] = ['name', 'association'];
    for (const matchType of searchTypes) {
      const videosData = matchType === 'name'
        ? await api.video.list({ filter:{ field:'name', value:`${ident}` }, limit:5 })
        : await api.video.search(`${ident}`, { limit:5 });
      if (videosData.results && videosData.results.length) {
        const videos = videosData.results;
        if (logger && videos.length > 1) {
          logger.warn(`${tag}: ident ${ident} matches at least ${videos.length} ${matchType}s`);
          for (let i = 0; i < videos.length; i++) {
            logger.warn(`${tag}:   ${videos[i].name}`)
          }
        }
        return { video:videos[0], matchType };
      }
    }
  }
}

/**
 * Lists (if possible) ALL related shows based on id, guid,
 * or (partial) name. Matches are ordered based on strength, with video-based
 * associations being weakest.
 */
export async function list(ident: string|number, show: VideoShow|null, context: Context): Promise<VideoMatch[]> {
  const { logger } = context;
  const tag = `commands.utils.videos.list`;

  const videoIDs = new Set<number>();
  const videos: VideoMatch[] = [];

  const showFilter = show ? { field:'video_show', value:show.id } : null;

  // Treat as an ID
  if (api.isID(ident)) {
    const filter = [{ field:'id', value:ident }];
    if (showFilter) filter.push(showFilter);
    const data = await api.video.list({ filter });
    if (data.results && data.results.length) {
      const video = data.results[0];
      if (logger) logger.debug(`${tag}: ident ${ident} is an ID; found ${video.name} (${video.guid})`);
      videoIDs.add(video.id);
      videos.push({ video, matchType:'id' });
    }
  } else if (logger) {
    logger.trace(`${tag}: ident ${ident} is not an ID`);
  }

  // Treat as a GUID
  if (api.isGUID(ident)) {
    try {
      const video = await api.video.get(`${ident}`.trim());
      if (show && (!video.video_show || video.video_show.id !== show.id)) throw new Error(`Wrong show`);
      if (logger) logger.debug(`${tag}: ident ${ident} is a guid; found ${video.name} (${video.guid})`);
      if (!videoIDs.has(video.id)) {
        videoIDs.add(video.id);
        videos.push({ video, matchType:'id' });
      }
    } catch (err) {
      if (logger) logger.debug(`${tag}: ident ${ident} was not found as a GUID`);
    }
  } else if (logger) {
    logger.trace(`${tag}: ident ${ident} is not a GUID`);
  }

  const searchTypes: VideoMatchType[] = ['name', 'association'];
  if (show) {
    // download all episodes; see if one fits
    const { results } = await api.video.all({
      fields: ['id', 'guid', 'associations', 'name', 'publish_date'],
      filter: { field:'video_show', value:show.id },
      sort: { field:'publish_date', direction:'asc' }
    });
    const regex = RegExp(`${ident}`, 'ig');
    for (const matchType of searchTypes) {
      let matches = matchType === 'name'
        ? (results || []).filter(v => (v.name||'').match(regex))
        : (results || []).filter(v => (v.associations || []).find(a => a.api_detail_url.includes('/game/') && (a.name||'').match(regex)));
      for (const match of matches) {
        if (!videoIDs.has(match.id)) {
          const video = await api.video.get(match.guid);
          videoIDs.add(video.id);
          videos.push({ video, matchType:'id' });
        }
      }
    }
  } else {
    // look for videos with this in their name or as an association
    for (const matchType of searchTypes) {
      const videosData = matchType === 'name'
        ? await api.video.list({ filter:{ field:'name', value:`${ident}` }, limit:5 })
        : await api.video.search(`${ident}`, { limit:5 });
      if (videosData.results && videosData.results.length) {
        const matches = videosData.results;
        if (logger && videosData.number_of_page_results < videosData.number_of_total_results) {
          logger.warn(`${tag}: ident ${ident} matches at least ${matches.length} ${matchType}s`);
          for (let i = 0; i < matches.length; i++) {
            logger.warn(`${tag}:   ${matches[i].name}`)
          }
        }
        for (const match of matches) {
          if (!videoIDs.has(match.id)) {
            const video = await api.video.get(match.guid);
            videoIDs.add(video.id);
            videos.push({ video, matchType:'id' });
          }
        }
      }
    }
  }

  return videos;
}

export async function episode(opts: VideoEpisodeOpts, context: Context): Promise<VideoEpisodeMatch|void> {
  const { logger } = context;
  const tag = `commands.utils.videos.episode`;

  const { episode, show, season } = opts;
  const episodes = opts.episodes || await shows.episodes(show, context);
  let seasonType = opts.seasonType || episodes.preferredSeasons;

  let video: Video|void = null;
  let seasons: VideoShowSeason[]|void = null;

  if (!season) {
    const guid = episodes.episodes[episode - 1].guid;
    video = await api.video.get(guid);
    seasons = episodes.seasons[seasonType];
    if (logger) logger.debug(`${tag}: found video ${video.name} as show episode ${episode}`);
  } else {
    const regex = RegExp(`${season}`, 'ig');
    const seasonNumber = Number(season);
    if (!isNaN(seasonNumber)) {
      let seasonObj = episodes.seasons[seasonType][seasonNumber - 1];
      if (!seasonObj) {
        seasonObj = episodes.seasons['years'].find(s => s.name.match(regex));
        seasonType = 'years';
        if (logger) logger.trace(`${tag}: trying "years" seasons as a match for numeric season`);
      } else if (logger) logger.trace(`${tag}: trying season ${seasonNumber}th ${seasonType} season`);

      if (seasonObj && episode <= seasonObj.episodes.length) {
        video = await api.video.get(seasonObj.episodes[episode - 1].guid);
        seasons = episodes.seasons[seasonType];
        if (logger) logger.debug(`${tag}: found video ${video.name} as ${seasonType} season ${seasonNumber} episode ${episode}`);
      }
    }
    if (!video) {
      if (logger) logger.trace(`${tag}: checking for games season with name ${season}`);
      const seasonObj = episodes.seasons['games'].find(s => s.name.match(regex));
      if (seasonObj && episode <= seasonObj.episodes.length) {
        video = await api.video.get(seasonObj.episodes[episode - 1].guid);
        seasons = episodes.seasons[seasonType];
        if (logger) logger.debug(`${tag}: found video ${video.name} as ${seasonType} season ${season} episode ${episode}`);
      }
    }
  }

  if (!video || !seasons) return null;
  const guid = video.guid;

  const seasonNumber = seasons.findIndex(s => s.episodes.some(e => e.guid === guid)) + 1;
  if (!seasonNumber) return null;

  return {
    video,
    seasonType,
    seasonNumber,
    seasonName: seasons[seasonNumber - 1].name,
    seasonEpisodeNumber: seasons[seasonNumber - 1].episodes.findIndex(e => e.guid === guid) + 1,
    showEpisodeNumber: episodes.episodes.findIndex(e => e.guid === guid) + 1,
    seasonEpisodeCount: seasons[seasonNumber - 1].episodes.length,
    showEpisodeCount: episodes.episodes.length,
    seasonCount: seasons.length
  }
}

export const videos = {
  find,
  list,
  episode
}

export default videos;
