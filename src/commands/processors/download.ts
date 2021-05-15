'use strict';

// packages
import util from 'util';
import read from 'read';

//  internal
import Parser from '../utils/parser';
import sharedOptions from '../utils/options';
import { ERROR } from '../utils/context';

import { api, Video, VideoShow, ListResult } from '../../api';
import { save } from '../utils/save';
import { shows } from '../utils/shows';
import { catalog, Catalog, CatalogEpisodeReference } from '../utils/catalog';
import { template } from '../utils/template';
import { videos, VideoMatch } from '../utils/videos';

// types
import { Context } from '../utils/context';

const readPromise = util.promisify(read);

export const aliases = ['download', 'get'];
export const summary = 'Downloads a GB video and/or its associated data.';

export const parser = new Parser({
  title: 'Download',
  description: 'Downloads a GB video and/or its associated data.',
  aliases,
  synopsis: [
    'download Endurance --season Shenmue --episode 4',
    'download "Quick Look" --video "nidhogg"'
  ],
  options: [
    { ...sharedOptions.show, defaultOption:true },
    sharedOptions.video,
    sharedOptions.episode,
    sharedOptions.season,
    sharedOptions.season_type,
    sharedOptions.quality,
    sharedOptions.out,
    sharedOptions.video_out,
    sharedOptions.json_out,
    sharedOptions.image_out,
    sharedOptions.replace,
    sharedOptions.commit
  ]
});

export async function process(argv: string[], context: Context): Promise<number> {
  const { api_key, logger } = context;

  const options =  parser.process(argv, logger);
  if (!options) return ERROR.NONE;

  const { show, video, episode, season, out, replace, commit } = options;
  const season_type = options['season-type'];
  const video_out = options['video-out'];
  const json_out = options['json-out'];
  const image_out = options['image-out'];
  const quality = options['quality'] || 'highest';

  if ((video === void 0) === (episode === void 0)) {
    throw new Error(`Must specify either --video <identifier> or --episode <number> (not both)`);
  }

  if ((video !== void 0) && (season !== void 0)) {
    throw new Error(`Cannot specify both --video <identifier> and --season <season>; omit "--season" or use "--episode <number>" instead`)
  }

  if (season_type !== void 0 && !["games", "years"].includes(season_type)) {
    throw new Error(`--season-type <type> must be "games" or "years"`);
  }

  if (quality !== void 0 && !["highest", "hd", "high", "low"].includes(quality)) {
    throw new Error(`--quality <quality> must be "highest", "hd", "high", or "low"`);
  }

  // goal is to get the Video and VideoShow specified, which may require
  // different approaches depending on input options.
  let targetVideo: Video|void = null;
  let targetShow: VideoShow|void = null;
  let targetCatalog: Catalog|void = null;
  let targetEpisode: CatalogEpisodeReference|void = null;

  // query for the show if possible
  if (show) {
    const match = await shows.find(show, context);
    if (match) {
      targetShow = match.show;
      logger.info(`Found ${match.show.title} by ${match.matchType}`);
    } else {
      logger.in('red').print(`No shows found for "${show}"`);
      return ERROR.UNKNOWN_SHOW;
    }
  }

  if (video) {
    const match = await videos.find(video, targetShow, context);
    if (match) {
      targetVideo = match.video;
      logger.info(`Found ${match.video.name} by ${match.matchType}`);
      if (!targetShow) {
        const showID = targetVideo.video_show ? targetVideo.video_show.id : null;
        if (!showID) throw new Error(`Video has no video_show.id`);
        const showMatch = await shows.find(showID, context);
        if (showMatch) {
          targetShow = showMatch.show;
        } else {
          logger.in('red').print(`No shows found for "${showID}"`);
          return ERROR.UNKNOWN_SHOW;
        }
      }

      if (!targetCatalog) targetCatalog = await catalog.create(targetShow, context);

      const videoID = targetVideo ? targetVideo.id : null;
      targetEpisode = await catalog.findEpisode({
        episode: targetCatalog.episodes.findIndex(a => a.id === videoID) + 1,
        show: targetShow,
        catalog: targetCatalog,
        seasonType: season_type
      }, context);
      if (!targetEpisode) {
        throw new Error(`Episode not found`);
      }
      logger.info(`Found ${targetVideo.name} as season ${targetEpisode.seasonNumber} episode ${targetEpisode.seasonEpisodeNumber}`);
    } else {
      logger.in('red').print(`No videos found for "${video}"`);
      return ERROR.UNKNOWN_VIDEO;
    }
  }

  if (episode) {
    if (!targetShow) throw new Error(`Must specify valid --show to identify a video by --episode`);
    if (!targetCatalog) targetCatalog = await catalog.create(targetShow, context);

    targetEpisode = await catalog.findEpisode({
      episode,
      show: targetShow,
      catalog: targetCatalog,
      season,
      seasonType: season_type
    }, context);
    if (!targetEpisode) {
      throw new Error(`Episode not found`);
    }
    targetVideo = targetEpisode.video;
    logger.info(`Found ${targetVideo.name} as season ${season} episode ${episode}`);
  }

  if (!targetShow || !targetVideo || !targetCatalog || !targetEpisode) {
    throw new Error(`Something went wrong`);
  }

  const seasonNumStr = `${targetEpisode.seasonNumber}`.padStart(2, '0');
  const seasonEpNumStr = `${targetEpisode.seasonEpisodeNumber}`.padStart(2, '0');

  logger.in('blue').print(`${targetShow.title} (id: ${targetShow.id})`);
  logger.in('blue').print(`  Season ${seasonNumStr} - ${targetEpisode.seasonName}`);
  logger.in('blue').print(`    Episode ${seasonEpNumStr} - ${targetVideo.name}`);
  logger.print();

  const no_out = ['no', 'null', 'none'];
  const toFilename = (out: string, fallback: string) => {
    if (out && no_out.includes(out.toLowerCase())) {
      return null;
    }
    if (!out || !targetShow || !targetEpisode) {
      return fallback;
    }
    return template.map(out, targetShow, targetEpisode);
  }

  const baseFilename = toFilename(out, null);
  const videoFilename = toFilename(video_out, baseFilename);
  const imageFilename = toFilename(image_out, baseFilename);
  const jsonFilename = toFilename(json_out, baseFilename);

  if (!jsonFilename && !imageFilename && !videoFilename) {
    logger.print(`To download, specify --out, --video_out, etc.`);
    return ERROR.NONE;
  }

  if (!commit) {
    logger.print(`Will download:`);
    if (videoFilename) logger.print(`  ${quality} quality video to ${videoFilename}[.ext]`);
    if (imageFilename) logger.print(`  ${quality} quality image to ${imageFilename}[.ext]`);
    if (jsonFilename) logger.print(`  json-format video info to ${jsonFilename}[.ext]`);
    logger.print()

    logger.in('bright').print(`To confirm, type "commit" and press ENTER`);
    const textIn = await readPromise({ prompt: `: `});
    if (textIn.trim() !== 'commit') {
      logger.print(`Canceled.`);
      return ERROR.NONE;
    }
  }

  if (jsonFilename) {
    logger.info(`Saving json-format video info to ${jsonFilename}[.ext]...`);
    await save.videoInfo(targetVideo, { filename:jsonFilename, logger, replace });
  }

  if (imageFilename) {
    logger.info(`Saving ${quality} quality image to ${imageFilename}[.ext]...`);
    await save.videoImage(targetVideo, { filename:imageFilename, logger, replace, quality }, context);
  }

  if (videoFilename) {
    logger.info(`Saving ${quality} quality video to ${videoFilename}[.ext]...`);
    await save.video(targetVideo, { filename:videoFilename, logger, replace, quality }, context);
  }

  logger.in('bright').print('Done!');
  return ERROR.NONE;
}
