'use strict';

// packages
import util from 'util';
import read from 'read';

//  internal
import Parser from '../utils/parser';
import sharedOptions from '../utils/options';
import { ERROR } from '../utils/context';

// utilities
import { api, Video, VideoShow, ListResult } from '../../api';
import { save, SaveResult } from '../utils/save';
import { shows } from '../utils/shows';
import { catalog, Catalog, CatalogEpisodeReference } from '../utils/catalog';
import { template } from '../utils/template';
import { videos, VideoMatch } from '../utils/videos';

//  subprocesses
import { anchor, AnchorOpts, AnchorType, AnchorDirection, AnchorResult } from './subprocessors/anchor';

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
    'download Endurance --season Shenmue --episode 4 --out <template>',
    'download "Quick Look" --video "nidhogg" --out <template>',
    'download "Game of the Year" from --season 2014 through --season 2015 --out <template>',
    'download "Quick Look" to --episode 100 --out <template>',
    'download <show> [season options] [download options]',
    'download <show> [episode options] [download options]',
    'download <show> [<from, after, to, through> [episode options]] [download options]'
  ],
  options: [
    { ...sharedOptions.show, defaultOption:true },
    sharedOptions.video,
    sharedOptions.episode,
    sharedOptions.season,
    sharedOptions.season_type,
    sharedOptions.show_only,
    sharedOptions.quality,
    sharedOptions.out,
    sharedOptions.video_out,
    sharedOptions.image_out,
    sharedOptions.metadata_out,
    sharedOptions.show_out,
    sharedOptions.show_image_out,
    sharedOptions.show_metadata_out,
    sharedOptions.file_limit,
    sharedOptions.megabyte_limit,
    sharedOptions.replace,
    sharedOptions.details,
    sharedOptions.commit
  ],
  misc: [
    {
      header: 'Download anchors: "from", "after", "to", "through"',
      content: `
      Use content anchors to download batches of videos (or images, etc.)
      from the specified show. Anchors identify a particular episode
      (or season) of the show; the batch will begin or end with that episode.

      For example,

      'download "Game of the Year" from --season 2014 through --season 2016'

      will download all episodes of the "Game of the Year" show in the 2014,
      2015, and 2016 seasons.

      'download "Quick Look" to --video "Balan Wonderworld"'

      will download all Quick Look episodes up to -- but not including --
      Balan Wonderworld.

      "from" and "after" indicate the start of a batch, with "from" including
      the episode (or season) specified.

      "to" and "through" indicate the end of a batch, with "through" including
      the episode (or season) specified.

      For more information, use "download <show> from help".
      `
    }
  ]
});

export async function process(argv: string[], context: Context): Promise<number> {
  const { api_key, logger } = context;

  // note: subprocess commands can be mixed with main command arguments.
  // repeatedly parse to find the break points and reconstruct the main arguments
  // and any subprocess args.
  interface AnchorCommand {
    anchorType: AnchorType;
    argv: string[];
  }

  let processArgv: string[] = [];
  let remainingArgv: string[] = [...argv];
  const anchorCommands: AnchorCommand[] = [];
  while (remainingArgv.length) {
    logger.trace(`download preprocessing: examining [${remainingArgv}]`);
    let remaining: any[] = [];
    if (anchor.aliases.includes(remainingArgv[0])) {
      remaining = remainingArgv;
    } else {
      const options = parser.process(processArgv.concat(remainingArgv), logger, { stopAtFirstUnknown: true });
      if (!options) { //  help screen displayed
        return ERROR.NONE;
      }
      remaining = options._unknown || [];
      processArgv = processArgv.concat(remainingArgv.slice(0, remainingArgv.length - remaining.length));
      logger.trace(`download preprocessing: process [${processArgv}], remaining [${remaining}]`);
    }

    if (remaining.length) {
      if (!anchor.aliases.includes(remaining[0])) {
        logger.in('red').error(`Don't recognize download option ${remaining[0]}.`);
        logger.print(parser.help());
        throw new Error(`Unrecognized option ${remaining[0]}`);
      }

      logger.trace(`download preprocessing: examining anchor command [${remaining}]`);
      const anchorOptions = anchor.preprocess(remaining.slice(1), context);
      if (!anchorOptions) return ERROR.NONE;
      remainingArgv = anchorOptions._unknown || [];

      const cmd = {
        anchorType:remaining[0],
        argv:remaining.slice(1, remaining.length - remainingArgv.length)
      };
      anchorCommands.push(cmd);
      logger.trace(`download preprocessing: anchor "${cmd.anchorType}" consumed ${cmd.argv}`);
    } else {
      logger.trace(`download preprocessing: ready to execute`);
      logger.trace(`  [${processArgv}]`)
      for (const cmd of anchorCommands) {
        logger.trace(`  [${[cmd.anchorType, ...cmd.argv]}]`);
      }
      remainingArgv =  [];
    }
  }

  const options =  parser.process(processArgv, logger);
  if (!options) return ERROR.NONE;

  const { show, video, episode, season, out, replace, details, commit } = options;
  const season_type = options['season-type'];
  const video_out = options['video-out'];
  const data_out = options['metadata-out'];
  const image_out = options['image-out'];
  const show_out = options['show-out'];
  const show_image_out = options['show-image-out'];
  const show_metadata_out = options['show-metadata-out'];
  const file_limit = options['file-limit'];
  const megabyte_limit = options['megabyte-limit'];
  const show_only = options['show-only'];
  const quality = options['quality'] || 'highest';

  if ((video !== void 0) && (episode !== void 0)) {
    throw new Error(`Can't use both --video <identifier> and --episode <number>`);
  }

  if (show_only && ((video != void 0) || (episode !== void 0) || (season !== void 0) || (anchorCommands.length))) {
    throw new Error(`Cannot combine --show-only with video/season/episode selection`);
  }

  if ((video !== void 0) && (season !== void 0)) {
    throw new Error(`Cannot specify both --video <identifier> and --season <season>; omit "--season" or use "--episode <number>" instead`)
  }

  if (anchorCommands.length && ((video !== void 0) || (episode !== void 0))) {
    throw new Error(`Cannot combine single-episode downloads with [from, after, to, through] anchors`);
  }

  if (season_type !== void 0 && !["games", "years"].includes(season_type)) {
    throw new Error(`--season-type <type> must be "games" or "years"`);
  }

  if (quality !== void 0 && !["highest", "hd", "high", "low"].includes(quality)) {
    throw new Error(`--quality <quality> must be "highest", "hd", "high", or "low"`);
  }

  if (file_limit && replace) {
    logger.warn(`Warning: using --replace and --file-limit together makes it harder to expand existing collections.`)
  }

  if (megabyte_limit && replace) {
    logger.warn(`Warning: using --replace and --megabyte-limit together makes it harder to expand existing collections.`)
  }

  // Note: anchor-free downloads are equivalent to "from X" "through X" for the
  // same single element (episode or season). Full-show downloads are equivalent
  // to "from 1" "through <max>".
  const anchors: AnchorResult[] = [];
  let targetShow: VideoShow|void = null;
  let targetCatalog: Catalog|void = null;

  // query for the show if possible
  if (show) {
    const match = await shows.find(show, context);
    if (match) {
      targetShow = match.show;
      targetCatalog = await catalog.create(targetShow, context);
      logger.info(`Found ${match.show.title} by ${match.matchType}`);

      if (show_only) {
        const anchorOpts: AnchorOpts = {
          show: targetShow,
          showCatalog: targetCatalog,
          seasonType: season_type || targetCatalog.preferredSeasons,
          anchorType: 'to',
          episode: 1
        }
        anchors.push(await anchor.find(anchorOpts, context));
      }
    } else {
      logger.in('red').print(`No shows found for "${show}"`);
      return ERROR.UNKNOWN_SHOW;
    }
  }

  if (show_only) {
    anchors.push()
  }

  if (video) {
    const match = await videos.find(video, targetShow, context);
    if (match) {
      const targetVideo = match.video;
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
      const episodeNumber = targetCatalog.episodes.findIndex(a => a.id === targetVideo.id) + 1;
      const anchorOpts: AnchorOpts = {
        show: targetShow,
        showCatalog: targetCatalog,
        seasonType: season_type || targetCatalog.preferredSeasons,
        anchorType: 'from',
        episode: episodeNumber
      }
      anchors.push(await anchor.find(anchorOpts, context));
      anchors.push(await anchor.find({ ...anchorOpts, anchorType: 'through' }, context));
    } else {
      logger.in('red').print(`No videos found for "${video}"`);
      return ERROR.UNKNOWN_VIDEO;
    }
  }

  if (season && episode === void 0) {
    if (!targetShow) throw new Error(`Must specify valid --show to identify a video by --season`);
    if (!targetCatalog) targetCatalog = await catalog.create(targetShow, context);

    const anchorOpts: AnchorOpts = {
      show: targetShow,
      showCatalog: targetCatalog,
      seasonType: season_type || targetCatalog.preferredSeasons,
      anchorType: 'from',
      season
    }
    anchors.push(await anchor.find(anchorOpts, context));
    anchors.push(await anchor.find({ ...anchorOpts, anchorType: 'through' }, context));
  }

  if (episode) {
    if (!targetShow) throw new Error(`Must specify valid --show to identify a video by --episode`);
    if (!targetCatalog) targetCatalog = await catalog.create(targetShow, context);

    const anchorOpts: AnchorOpts = {
      show: targetShow,
      showCatalog: targetCatalog,
      seasonType: season_type || targetCatalog.preferredSeasons,
      anchorType: 'from',
      season
    }
    anchors.push(await anchor.find(anchorOpts, context));
    anchors.push(await anchor.find({ ...anchorOpts, anchorType: 'through' }, context));
  }

  if (!targetShow || !targetCatalog) {
    throw new Error(`Something went wrong: can't identify show or create catalog`);
  }

  for (const anchorCommand of anchorCommands) {
    const targetAnchor = await anchor.process(anchorCommand.argv, {
      ...context,
      show: targetShow,
      showCatalog: targetCatalog,
      seasonType: season_type || targetCatalog.preferredSeasons,
      anchorType: anchorCommand.anchorType,
      season
    });
    if (!targetAnchor) {
      // assume help displayed
      logger.debug(`download: no "anchor" subprocess result; assume help screen displayed`);
      return ERROR.NONE;
    }
    anchors.push(targetAnchor);
  }

  // mark: each anchor divides the full episode list into valid and invalid.
  // to be included, a video must be valid under __every__ specified anchor
  // (i.e. each anchor eliminates candidates).
  // Note that because seasons might hypothetically overlap in the full-show
  // ordering, you may end up with swiss-cheese selection if nomenclature is mixed.
  let includedIDs = new Set<number>();
  targetCatalog.episodes.forEach(v => includedIDs.add(v.id));
  for (const a of anchors) {
    const anchoredIDs = new Set<number>();
    if (a.structure === 'season') {
      const sStart = a.episode.seasonNumber - 1;
      let eStart = a.episode.seasonEpisodeNumber - 1;
      if (a.direction === 'forward') {
        if (!a.inclusive) eStart++;
        for (let s = sStart; s < a.episode.seasonCount; s++) {
          const eps = targetCatalog.seasons[a.episode.seasonType][s].episodes;
          for (let e = (s === sStart ? eStart : 0); e < eps.length; e++) {
            anchoredIDs.add(eps[e].id);
          }
        }
      } else {
        if (!a.inclusive) eStart--;
        for (let s = sStart; s >= 0; s--) {
          const eps = targetCatalog.seasons[a.episode.seasonType][s].episodes;
          for (let e = (s === sStart ? eStart : eps.length - 1); e >= 0; e--) {
            anchoredIDs.add(eps[e].id);
          }
        }
      }
    } else if (a.structure === 'flat') {
      let eStart = targetCatalog.episodes.findIndex(v => v.id === a.episode.video.id);
      if (a.direction === 'forward') {
        if (!a.inclusive) eStart++;
        for (let e = eStart; e < targetCatalog.episodes.length; e++) {
          anchoredIDs.add(targetCatalog.episodes[e].id);
        }
      } else {
        if (!a.inclusive) eStart--;
        for (let e = eStart; e >= 0; e--) {
          anchoredIDs.add(targetCatalog.episodes[e].id);
        }
      }
    }
    includedIDs = new Set([...includedIDs].filter(i => anchoredIDs.has(i)));
  }


  const seasons = targetCatalog.seasons[season_type || targetCatalog.preferredSeasons];
  let firstIncluded: CatalogEpisodeReference|void = null;

  logger.print();
  logger.in(includedIDs.size ? 'blue' : 'black').print(`${targetShow.title}  (id: ${targetShow.id})`);
  for (let s = 0; s < seasons.length; s++) {
    const episodes = seasons[s].episodes;
    const seasonIncluded = episodes.some(ep => includedIDs.has(ep.id));

    if (seasonIncluded || details) {
      const seasonName = seasons[s].name;
      const seasonNumStr = `${s + 1}`.padStart(2, '0');
      logger.in(seasonIncluded ? 'blue' : 'black').print(`  Season ${seasonNumStr} - ${seasonName}`);

      for (let e = 0; e < episodes.length; e++) {
        const targetVideo = episodes[e];
        const included = includedIDs.has(targetVideo.id);
        const episodeNumStr = `${e + 1}`.padStart(2, '0');
        const prefix = !details ? '  ' : (included ? ' + ' : '   ');
        if (included || details) {
          logger.in(included ? 'blue' : 'dim').print(`  ${prefix}Episode ${episodeNumStr} - ${targetVideo.name}`);
        }

        if (included && !firstIncluded) {
          firstIncluded = await catalog.findEpisode({
            episode: e + 1,
            show: targetShow,
            catalog: targetCatalog,
            season: s + 1,
            seasonType: season_type
          }, context);
        }
      }
    }
  }
  logger.print();

  const no_out = ['no', 'null', 'none'];
  const toFilename = (out: string|void, fallback: string|void, episode: CatalogEpisodeReference|void, quality?: string) => {
    if (out && no_out.includes(out.toLowerCase())) {
      return null;
    }
    const t = out ? out : fallback;
    return t ? template.map(t, { show:targetShow, episode, quality }) : null;
  }

  const exampleQuality = quality === 'highest' ? 'hd' : quality;
  const baseFilenameExample = toFilename(out, null, firstIncluded);
  const videoFilenameExample = toFilename(video_out, baseFilenameExample, firstIncluded, exampleQuality);
  const imageFilenameExample = toFilename(image_out, baseFilenameExample, firstIncluded, exampleQuality);
  const dataFilenameExample = toFilename(data_out, baseFilenameExample, firstIncluded, 'info');
  const baseShowFilenameExample = toFilename(show_out, null, null);
  const showImageFilenameExample = toFilename(show_image_out, baseShowFilenameExample, null, exampleQuality);
  const showDataFilenameExample = toFilename(show_metadata_out, baseShowFilenameExample, null, 'info');

  const saveEpisodes = includedIDs.size && (dataFilenameExample || imageFilenameExample || videoFilenameExample);
  const saveShow = showImageFilenameExample || showDataFilenameExample;

  if (!saveEpisodes && !saveShow) {
    if (!firstIncluded && !show_only) {
      logger.print(`No episodes flagged for download (try relaxing your from/after/to/through requirements).`);
    } else {
      logger.print(`To save, specify --out, --video-out, etc. as a templated filename`);
    }
    return ERROR.NONE;
  }

  if (!commit) {
    const action = replace ? `download (and replace)` : `download (if missing)`;
    if (saveShow) {
      logger.print(`Will ${action} data for show "${targetShow.title}" to template-based files, saving`);
      if (showImageFilenameExample) logger.print(`  ${quality} quality image to "${showImageFilenameExample}.png"`);
      if (showDataFilenameExample) logger.print(`  show metadata to "${showDataFilenameExample}.json"`);
    }
    if (saveEpisodes) {
      logger.print(`Will ${action} data for ${includedIDs.size} video(s) to template-based files, saving (e.g.)`);
      if (videoFilenameExample) logger.print(`  ${quality} quality video to "${videoFilenameExample}.mp4"`);
      if (imageFilenameExample) logger.print(`  ${quality} quality image to "${imageFilenameExample}.png"`);
      if (dataFilenameExample) logger.print(`  video metadata to "${dataFilenameExample}.json"`);
    } else if (!show_only) {
      if (!firstIncluded) {
        logger.print(`No episodes flagged for download (try relaxing your from/after/to/through requirements).`);
      } else {
        logger.print(`To save episodes, specify --out, --video-out, etc. as a templated filename`);
      }
    }
    logger.print()

    logger.in('bright').print(`To confirm, type "commit" and press ENTER`);
    const textIn = await readPromise({ prompt: `: `});
    if (textIn.trim() !== 'commit') {
      logger.print(`Canceled.`);
      return ERROR.NONE;
    }
  }

  let limitReached: boolean = false;
  let episodesSaved = 0;
  let bytesSaved = 0;

  if (saveShow) {
    const baseFilename = toFilename(show_out, null, null);
    const imageFilename = toFilename(show_image_out, baseFilename, null);
    const dataFilename = toFilename(show_metadata_out, baseFilename, null, 'info');
    const results: SaveResult[] = [];

    logger.print(`Saving ${targetShow.title}...`);
    if (dataFilename) {
      logger.info(`Saving show metadata to ${dataFilename}.json...`);
      const result = await save.showInfo(targetShow, { filename:dataFilename, logger, replace });
      results.push(result);
    }

    if (imageFilename) {
      logger.info(`Saving ${quality} quality image to ${imageFilename}[.ext]...`);
      const result = await save.showImage(targetShow, { filename:imageFilename, logger, replace, quality }, context);
      results.push(result);
    }

    const size = results.reduce((acc, r) => acc + (r.updated ? r.size : 0), 0);

    bytesSaved += size;
    if (megabyte_limit && megabyte_limit <= bytesSaved / (1024 * 1024)) {
      logger.print(`Saved ${(bytesSaved / (1024 * 1024)).toFixed(2)} megabytes; size limit reached`);
      limitReached = true;
    }
  }

  if (saveEpisodes) {
    for (let s = 0; s < seasons.length && !limitReached; s++) {
      const episodes = seasons[s].episodes;
      const sNumStr = `${s + 1}`.padStart(2, '0');
      for (let e = 0; e < episodes.length && !limitReached; e++) {
        const ep = episodes[e];
        const included = includedIDs.has(ep.id);
        if (!included) continue;

        const targetEpisode = await catalog.findEpisode({
          episode: e + 1,
          show: targetShow,
          catalog: targetCatalog,
          season: s + 1,
          seasonType: season_type
        }, context);

        const targetVideo  = targetEpisode.video;

        const baseFilename = toFilename(out, null, targetEpisode);
        const videoFilename = toFilename(video_out, baseFilename, targetEpisode);
        const imageFilename = toFilename(image_out, baseFilename, targetEpisode);
        const dataFilename = toFilename(data_out, baseFilename, targetEpisode, 'info');

        const results: SaveResult[] = [];

        const eNumStr = `${e + 1}`.padStart(2, '0');
        logger.print(`Saving S${sNumStr}E${eNumStr} - ${targetVideo.name}...`);
        if (dataFilename) {
          logger.info(`Saving video metadata to ${dataFilename}.json...`);
          const result = await save.videoInfo(targetVideo, { filename:dataFilename, logger, replace });
          results.push(result);
        }

        if (imageFilename) {
          logger.info(`Saving ${quality} quality image to ${imageFilename}[.ext]...`);
          const result = await save.videoImage(targetVideo, { filename:imageFilename, logger, replace, quality }, context);
          results.push(result);
        }

        if (videoFilename) {
          logger.info(`Saving ${quality} quality video to ${videoFilename}[.ext]...`);
          const result = await save.video(targetVideo, { filename:videoFilename, logger, replace, quality }, context);
          results.push(result);
        }

        const updated = results.some(r => r.updated);
        const size = results.reduce((acc, r) => acc + (r.updated ? r.size : 0), 0);

        if (updated) {
          episodesSaved++;
          if (file_limit && file_limit <= episodesSaved) {
            logger.print(`Saved ${episodesSaved} episodes: file limit reached`);
            limitReached = true;
          }
        }

        bytesSaved += size;
        if (megabyte_limit && megabyte_limit <= bytesSaved / (1024 * 1024)) {
          logger.print(`Saved ${(bytesSaved / (1024 * 1024)).toFixed(2)} megabytes; size limit reached`);
          limitReached = true;
        }
      }
    }
  }

  logger.in('bright').print('Done!');
  return ERROR.NONE;
}
