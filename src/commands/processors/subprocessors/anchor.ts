'use strict';

// packages
import util from 'util';
import read from 'read';

//  internal
import Parser from '../../utils/parser';
import sharedOptions from '../../utils/options';
import { ERROR } from '../../utils/context';

import { api, Video, VideoShow, ListResult } from '../../../api';
import { save } from '../../utils/save';
import { shows } from '../../utils/shows';
import { catalog, Catalog, CatalogEpisodeReference, CatalogSeasonType } from '../../utils/catalog';
import { template } from '../../utils/template';
import { videos, VideoMatch } from '../../utils/videos';

// types
import { Context } from '../../utils/context';

const readPromise = util.promisify(read);

export const aliases = ['from', 'after', 'to', 'through'];
export const summary = 'Identifies an episode or season as a boundary (anchor) for downloading batches of Giant Bomb videos.';

export const parser = new Parser({
  title: 'Anchor',
  description: 'Identifies an episode or season as a boundary (anchor) for downloading batches of Giant Bomb videos.',
  aliases,
  synopsis: [
    'from --season Shenmue --episode 4',
    'after --episode 40',
    'through -i S04E17',
    'to --video "nidhogg"'
  ],
  options: [
    {
      name: 'identifier', alias: 'i', type: String,
      description: "A one-word episode catalog reference, such as 'S02E30' or 'S04', a valid video ID or GUID, or a date (e.g. '2015-03-17' or '2020')"
    },
    sharedOptions.video,
    sharedOptions.episode,
    sharedOptions.season
  ]
});

export type AnchorType = 'from'|'after'|'to'|'through';
export type AnchorDirection = 'forward'|'backward';
export interface AnchorContext extends Context {
  show: VideoShow;
  showCatalog: Catalog;
  seasonType: CatalogSeasonType;
  anchorType: AnchorType;
  season?: string|number|void;
}

export interface AnchorOpts {
  show: VideoShow;
  showCatalog: Catalog;
  seasonType: CatalogSeasonType;
  identifier?: string|void;
  video?: string|void;
  episode?: number|void;
  season?: string|number|void;
  anchorType: AnchorType;
}

export interface AnchorResult {
  episode: CatalogEpisodeReference;
  inclusive: boolean;
  direction: AnchorDirection;
}

export async function find(opts: AnchorOpts, context: Context): Promise<AnchorResult> {
  const { logger } = context;
  const { show, showCatalog, seasonType, anchorType, identifier, video, episode, season } = opts;

  if ((video !== void 0) && (season !== void 0)) {
    throw new Error(`Cannot specify both --video <identifier> and --season <season>; omit "--season" or use "--episode <number>" instead`)
  }

  // identify inclusivity and direction. default is "from"
  let inclusive = true;
  let direction: AnchorDirection = 'forward';
  if (anchorType === 'after') {
    inclusive = false;
  } else if (anchorType === 'to') {
    inclusive = false;
    direction = 'backward';
  } else if (anchorType === 'through') {
    inclusive = true;
    direction = 'backward';
  }

  let identifierCount = 0;
  if (identifier !== void 0) identifierCount++;
  if (video !== void 0) identifierCount++;
  if (episode !== void 0) identifierCount++;

  if (identifierCount > 1) {
    throw new Error(`Must specify a one-word identifier, or at least one of --video, --episode, --season`);
  } else if (!identifierCount) {
    // possibly just a season?
    if (season === void 0) {
      throw new Error(`Must specify a one-word identifier, or at least one of --video, --episode, --season`);
    }

    const seasonCatalogReference = await catalog.findSeason({ show, season:`${season}`, catalog:showCatalog, seasonType }, context);
    if (!seasonCatalogReference) throw new Error(`Can't find season ${season}`);

    // either the first or last episode, depending on anchor type.
    // direction and inclusivity are already set, so find the episode that is
    // the "outer boundary" of the season.
    let episodeNumber = 1;
    if (anchorType === 'after' || anchorType  === 'through') {
      episodeNumber = seasonCatalogReference.seasonEpisodeCount;
    }

    const episodeCatalogReference = await catalog.findEpisode({
      episode: episodeNumber,
      show,
      catalog: showCatalog,
      season: seasonCatalogReference.seasonNumber,
      seasonType: seasonCatalogReference.seasonType
    }, context);
    if (!episodeCatalogReference) {
      throw new Error(`Couldn't find episode ${episodeNumber} in season ${season}`);
    }

    return {
      episode: episodeCatalogReference,
      inclusive,
      direction
    };
  }

  // three options:
  // identifier, S01E03 --or-- a date string.
  // --video <text>, freeform search within the show.
  // --episode <ep> [--season <s>], numerical episode number [1, 2, ...].
  let episodeCatalogReference: CatalogEpisodeReference|void = null;

  if (episode !== void 0) {
    const episodeReal: number = episode as number;  // for typescript
    const opts = { episode: episodeReal, show, catalog:showCatalog, season, seasonType };
    episodeCatalogReference = await catalog.findEpisode(opts, context);
    if (!episodeCatalogReference) {
      throw new Error(`Couldn't find episode ${episode} season ${season}`);
    }
  } else if (video !== void 0) {
    const videoReal: string = video as string;  // for typescript
    const match = await videos.find(videoReal, show, context);
    if (!match) {
      throw new Error(`No videos found for "${video}"`);
    }
    const opts = {
      episode: showCatalog.episodes.findIndex(a => a.id === match.video.id) + 1,
      show, catalog:showCatalog, seasonType
    }
    episodeCatalogReference = await catalog.findEpisode(opts, context);
    if (!episodeCatalogReference) {
      throw new Error(`Couldn't find episode for video "${video}"`);
    }
  } else if (identifier) {
    // attempt to parse identifier. Note that date-based identifiers
    // have unique AnchorType behavior, since they fall between episodes,
    // not on them.
    const seRegex = /(S[A-Za-z]*\s*(\d+))?\s*E[A-Za-z]*\s*(\d+)/i
    const seMatch = identifier.match(seRegex);
    const date = Date.parse(identifier);
    if (seMatch) {
      const opts = { episode:Number(seMatch[3]), show, catalog:showCatalog, season:seMatch[2], seasonType };
      episodeCatalogReference = await catalog.findEpisode(opts, context);
      if (!episodeCatalogReference) {
        throw new Error(`Couldn't find episode for episode ${seMatch[3]} season ${seMatch[2]}`);
      }
    } else if (!isNaN(date)) {
      throw new Error(`TODO: implement Date-based parsing that supports intuitive forms like "through 2018" or "after May 2017"`);
    } else {
      throw new Error(`Couldn't make heads or tails of identifier ${identifier}. Try something like "S02E14"`);
    }
  }

  if (episodeCatalogReference) {
    return {
      episode: episodeCatalogReference,
      inclusive,
      direction
    };
  } else {
    throw new Error(`Failed to identify an anchor episode.`);
  }
}

export async function process(argv: string[], context: AnchorContext): Promise<AnchorResult|void> {
  const { show, showCatalog, seasonType, anchorType, logger } = context;

  const options = parser.process(argv, logger);
  if (!options) return null;

  const { identifier, video, episode } = options;
  const season = options.season || context.season;

  return find({ show, showCatalog, seasonType, anchorType, identifier, video, episode, season }, context);
}

export const anchor = {
  aliases,
  summary,
  parser,
  find,
  process
}

export default anchor;
