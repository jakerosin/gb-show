'use strict';

import { api, Video, VideoShow, ListFieldFilter } from '../../api';
import { shows } from './shows';

import { Context } from './context';

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

function onlyNonNullUnique(value, index, self) {
  return !!value && self.indexOf(value) === index;
}

export interface VideoMatchOpts {
  query: string|number;
  show?: VideoShow|void;
  filter?: ListFieldFilter|ListFieldFilter[];
}

export type VideoMatchType = 'id'|'name'|'association';

export interface VideoMatch {
  video: Video;
  matchType: VideoMatchType;
};

function checkFilter(obj: any, filter: ListFieldFilter[]): boolean {
  for (const f of filter) {
    let ok = true;
    const objValue = obj[f.field];
    const start = f['start'];
    const end = f['end'];
    const value = f['value'];
    if (start && end) {
      const d = new Date(`${objValue}Z`);
      ok = start <= d && d <= end;
    } else {
      // TODO more sensible comparisons for field types?
      const regex = RegExp(`${value}`, 'ig');
      ok = objValue === value || (objValue === void 0 && value === void 0) || !!`${objValue}`.match(regex);
    }
    if (!ok) return false;
  }
  return true;
}

/**
 * Finds (if possible) the indicated show based on its id, guid,
 * or (partial) name. "Name" is an ambiguous match; the first such match
 * is provided, although the ambiguity is logged.
 */
export async function find(opts: VideoMatchOpts, context: Context): Promise<VideoMatch|void> {
  const { logger } = context;
  const tag = `commands.utils.videos.find`;

  const ident = opts.query;
  const { show } = opts;
  const showFilter = show ? { field:'video_show', value:show.id } : null;
  const optsFilter = [].concat(opts.filter || []);

  // Treat as an ID
  if (api.isID(ident)) {
    const filter = [...optsFilter, { field:'id', value:ident }];
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
      if (checkFilter(video, optsFilter)) {
        if (logger) logger.debug(`${tag}: ident ${ident} is a guid; found ${video.name} (${video.guid})`);
        return { video, matchType:'id' };
      } else {
        if (logger) logger.debug(`${tag}: ident ${ident} is a guid; found ${video.name} (${video.guid}) but does not match filter ${JSON.stringify(optsFilter)}`);
      }
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
      filter: [...optsFilter, { field:'video_show', value:show.id }],
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
        logger.warn(`${tag}: ident ${ident} matches at least ${matches.length} ${matchType}s (some will be omitted)`);
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
        ? await api.video.list({
          filter:[...optsFilter, { field:'name', value:`${ident}` }],
          sort: { field:'publish_date', direction:'asc' },
          limit:5
        })
        : await api.video.search(`${ident}`, { limit:5 });
      if (videosData.results && videosData.results.length) {
        const videos = videosData.results.filter(a => checkFilter(a, optsFilter));
        if (logger && videos.length > 1) {
          logger.warn(`${tag}: ident ${ident} matches at least ${videos.length} ${matchType}s (some will be omitted)`);
          for (let i = 0; i < videos.length; i++) {
            logger.info(`${tag}:   ${videos[i].name}`)
          }
        }
        if (videos.length) return { video:videos[0], matchType };
      }
    }
  }
}

/**
 * Lists (if possible) ALL related shows based on id, guid,
 * or (partial) name. Matches are ordered based on strength, with video-based
 * associations being weakest.
 */
export async function list(opts: VideoMatchOpts, context: Context): Promise<VideoMatch[]> {
  const { logger } = context;
  const tag = `commands.utils.videos.list`;

  const videoIDs = new Set<number>();
  const videos: VideoMatch[] = [];

  const ident = opts.query;
  const { show } = opts;
  const showFilter = show ? { field:'video_show', value:show.id } : null;
  const optsFilter = [].concat(opts.filter || []);

  // Treat as an ID
  if (api.isID(ident)) {
    const filter = [...optsFilter, { field:'id', value:ident }];
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
      if (checkFilter(video, optsFilter)) {
        if (logger) logger.debug(`${tag}: ident ${ident} is a guid; found ${video.name} (${video.guid})`);
        if (!videoIDs.has(video.id)) {
          videoIDs.add(video.id);
          videos.push({ video, matchType:'id' });
        }
      } else {
        if (logger) logger.debug(`${tag}: ident ${ident} is a guid; found ${video.name} (${video.guid}) but does not match filter ${JSON.stringify(optsFilter)}`);
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
      filter: [...optsFilter, { field:'video_show', value:show.id }],
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
          videos.push({ video, matchType });
        }
      }
    }
  } else {
    // look for videos with this in their name or as an association
    for (const matchType of searchTypes) {
      const videosData = matchType === 'name'
        ? await api.video.list({
          filter: [...optsFilter, { field:'name', value:`${ident}` }],
          sort: { field:'publish_date', direction:'asc' },
          limit: 30
        })
        : await api.video.search(`${ident}`, { limit:10 });
      if (videosData.results && videosData.results.length) {
        const matches = videosData.results.filter(a => checkFilter(a, optsFilter));
        if (logger && videosData.number_of_page_results < videosData.number_of_total_results) {
          logger.warn(`${tag}: ident ${ident} matches at least ${videosData.number_of_total_results} ${matchType}s (some will be omitted)`);
          for (let i = 0; i < matches.length; i++) {
            logger.info(`${tag}:   ${matches[i].name}`)
          }
        }
        for (const match of matches) {
          if (!videoIDs.has(match.id)) {
            const video = await api.video.get(match.guid);
            videoIDs.add(video.id);
            videos.push({ video, matchType });
          }
        }
      }
    }
  }

  return videos;
}

export const videos = {
  find,
  list
}

export default videos;
