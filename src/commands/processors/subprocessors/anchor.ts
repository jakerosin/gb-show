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
    'through S04E17',
    'to --video "nidhogg"'
  ],
  options: [
    sharedOptions.video,
    sharedOptions.episode,
    sharedOptions.season
  ]
});

export type AnchorType = 'from'|'after'|'to'|'through';
export type AnchorDirection = 'forward'|'backward';
export type AnchorStructure = 'flat'|'season';
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
  structure: AnchorStructure;
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
  let structure: AnchorStructure = season ? 'season' : 'flat';
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

    return {
      episode: episodeCatalogReference,
      inclusive,
      structure: 'season',
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
  } else if (video !== void 0) {
    const videoReal: string = video as string;  // for typescript
    const match = await videos.find({ query:videoReal, show }, context);
    if (!match) {
      throw new Error(`No videos found for "${video}"`);
    }
    const opts = {
      episode: showCatalog.episodes.findIndex(a => a.id === match.video.id) + 1,
      show, catalog:showCatalog, seasonType
    }
    episodeCatalogReference = await catalog.findEpisode(opts, context);
  } else if (identifier) {
    // attempt to parse identifier. Note that date-based identifiers
    // have unique AnchorType behavior, since they fall between episodes,
    // not on them.
    const seRegex = /(S[A-Za-z]*\s*(\d+))?\s*E[A-Za-z]*\s*(\d+)/i;
    const seMatch = identifier.match(seRegex);
    const sRegex = /S[A-Za-z]*\s*(\d+)/i;
    const sMatch = identifier.match(sRegex);
    const date = Date.parse(identifier);
    if (seMatch) {
      const seSeason = seMatch[2] ? seMatch[2] : season;
      structure = seSeason ? 'season' : 'flat';
      const opts = { episode:Number(seMatch[3]), show, catalog:showCatalog, season:seSeason, seasonType };
      episodeCatalogReference = await catalog.findEpisode(opts, context);
    } else if (sMatch) {
      const sSeason = Number(sMatch[1]);
      structure = 'season';
      const seasonCatalogReference = await catalog.findSeason({ show, season:sSeason, catalog:showCatalog, seasonType }, context);
      let episodeNumber = 1;
      if (anchorType === 'after' || anchorType  === 'through') {
        episodeNumber = seasonCatalogReference.seasonEpisodeCount;
      }
      const opts = { episode:episodeNumber, show, catalog:showCatalog, season:Number(sMatch[1]), seasonType };
      episodeCatalogReference = await catalog.findEpisode(opts, context);
    } else if (!isNaN(date)) {
      throw new Error(`TODO: implement Date-based parsing that supports intuitive forms like "through 2018" or "after May 2017"`);
    } else {
      throw new Error(`Couldn't make heads or tails of anchor identifier ${identifier}. Try something like "S02E14"`);
    }
  }

  if (episodeCatalogReference) {
    return {
      episode: episodeCatalogReference,
      inclusive,
      structure,
      direction
    };
  } else {
    throw new Error(`Failed to identify an anchor episode.`);
  }
}

export function preprocess(argv: string[], context: Context): any|void {
  const { logger } = context;

  const options = parser.process(argv, logger, { stopAtFirstUnknown:true });
  if (!options) return null;

  // note: a form we want to support is "<anchor> <identifier>", e.g. "from 2017".
  // This requires a defaultOption. However, we DON'T want it accidentally parsed
  // if other options are specified, since it would probably indicate the start of
  // a different subprocess or contiuation of the main process. e.g.
  // "<anchor_1> --episode <e_1> <anchor_2> --episode <e_2>", we don't want
  // <anchor_2> captured as an argument for <anchor_1>.
  // Therefore we do a special-case parsing if NO options are consumed by
  // the parser, and consume exactly one word as the default argument.
  if (argv.length && options._unknown && options._unknown.length === argv.length) {
    return {
      identifier: argv[0],
      _unknown: argv.slice(1)
    }
  }
  return options;
}

export async function process(argv: string[], context: AnchorContext): Promise<AnchorResult|void> {
  const { show, showCatalog, seasonType, anchorType, logger } = context;

  const options = preprocess(argv, context);
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
  preprocess,
  process
}

export default anchor;
