'use strict';

// packages
import util from 'util';
import read from 'read';

//  internal
import Parser from '../utils/parser';
import sharedOptions from '../utils/options';
import { ERROR } from '../utils/context';

// utilities
import { api, Video, VideoShow, ListResult, ListFieldFilter } from '../../api';
import { save, SaveResult } from '../utils/save';
import { shows } from '../utils/shows';
import { catalog, Catalog, CatalogEpisodeReference } from '../utils/catalog';
import { template, TemplateOpts } from '../utils/template';
import { videos, VideoMatch } from '../utils/videos';

//  subprocesses
import { anchor, AnchorOpts, AnchorType, AnchorDirection, AnchorResult } from './subprocessors/anchor';

// types
import { Context } from '../utils/context';

const readPromise = util.promisify(read);

export const aliases = ['download', 'save', 'get'];
export const summary = 'Downloads GB videos and/or associated data.';

export const parser = new Parser({
  title: 'Download',
  description: `
  Download and save Giant Bomb show videos or their associated data
  (image thumbnails, metadata, etc.).

  Individual videos can be downloaded, or batches of videos up to an entire
  show. Multiple forms are possible when specifying a batch, such as a season
  ("--season 2014"), an episode range ("from --episode 4 to --episode 20"),
  etc. Any video downloaded with this command must be organized into a show on
  the Giant Bomb API (not every video is).

  Downloaded files are stored in a templated file structure, with directory and
  filenames being generated based on video metadata -- title, episode number,
  etc. The output template must be specified; it has no default value and files
  will not be saved unless an output path is provided.

  As an example, try this command:

  $ download --video "Makes Mario" --video-out "\\{name\\}"
  `,
  aliases,
  synopsis: [
    'download "Thirteen Deadly Sims" --out <template>',
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
    sharedOptions.premium,
    sharedOptions.free,
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
    { header: 'File Output',
      content:`Downloaded output filenames are not automatically generated; to save a particular type of file (e.g. videos, episode thumbnails, etc.) you must specify a filename or name template. The appropriate file extension will be added for each file type.

      To disable downloads for a particular type of file, use "none" as the filename; for instance, "--out my_video --metadata-out none" will save a video and image thumbnail to "my_video.mp4"  and "my_video.png", respectively, but will not save episode metadata.`
    },
    {
      header: 'File Output Options',
      content: [
        { name: '-o, --out', summary:'An output path for the episode files' },
        {
          name: '-V, --video-out',
          summary:`An output path to use for the video file; ".mp4" will be appended. Use "none" to disable video downloads. If omitted, the value of --out is used.`
        },
        {
          name: '-I, --image-out',
          summary:`An output path to use for the episode's image thumbnail; ".png" or ".jpg" will be appended. Use "none" to disable thumbnail downloads. If omitted, the value of --out is used.`
        },
        {
          name: '-M, --metadata-out',
          summary:`An output path to use for episode's metadata; ".json" will be appended. Use "none" to disable metadata downloads. If omitted, the value of --out is used.`
        },
        { name: '--show-out', summary:'An output path for the show (not episode) files' },
        {
          name: '--show-image-out',
          summary:`An output path to use for the show's image thumbnail; ".png" or ".jpg" will be appended. Use "none" to disable thumbnail downloads. If omitted, the value of --show-out is used.`
        },
        {
          name: '--show-metadata-out',
          summary:`An output path to use for the show's metadata; ".json" will be appended. Use "none" to disable metadata downloads. If omitted, the value of --show-out is used.`
        }
      ]
    },
    {
      header: 'File Output Examples',
      content: [
        {
          example: '--out my_episode --metadata-out none',
          desc: `Save the video and thumbnail to "my_episode.mp4" and "my_episode.png", respectively; do not download the video metadata.`
        },
        {
          example: '--out extras/my_episode --video-out my_episode',
          desc: `Save the video to "my_episode.mp4"; download the image thumbnail and metadata, saving them in a directory called "extras" using the names "my_episode.png" and "my_episode.json". The "extras" directory will be created if necessary.`
        },
        {
          example: '--show-out output/show --out output/video --image-out none',
          desc: `Download metadata and a thumbnail image for the show, naming them "show.json" and "show.png". Also download the episode's video and metadata (but not image thumbnail), naming them "video.mp4" and "video.json". All these files will go in a directory named "output", which will be created if necessary.
          `
        }
      ]
    },
    {
      header: 'File Templates',
      content: `Use templates to automatically generate filenames for the downloaded content based on show and episode metadata. This is especially useful when downloading multiple episodes of a show so the downloaded files don't overwrite each other.

      Template names can be included as part of any file output argument ('--out', '--video-out', etc.) and will be automatically replaced with the appropriate value based on the show or video being saved.

      Template values are specified in curly braces, e.g. "\\{name\\}", as part of the file output path; for example, in  "--out output/\\{guid\\}", the video's unique GUID will be substituted for "\\{guid\\}", with output files like "output/2300-219.mp4", "output/2300-8648.json", etc.
      `
    },
    {
      header: 'File Template Examples',
      content: [
        {
          example: '--out "\\{show\\}/\\{guid\\} - \\{name\\}"',
          desc: `
          Save episode files (video, image, metadata) in a directory named after the show, using a filename based on the video's GUID and episode title.

          e.g. will save videos to:

          | Endurance Run/
          |   2300-219 - Endurance Run- Persona 4 - Part 01.mp4
          |   2300-220 - Endurance Run- Persona 4 - Part 02.mp4
          |   2300-222 - Endurance Run- Persona 4 - Part 03.mp4
          |   ...
          | VinnyVania/
          |   2300-8648 - VinnyVania- Castlevania - Part 01
          |   2300-8697 - VinnyVania- Castlevania - Part 02
          |   2300-8827 - VinnyVania- Castlevania - Part 03
          |   ...
          `
        },
        {
          example: '--out "\\{show\\}/Season \\{s\\} - \\{season_name\\}/S\\{s\\}E\\{e\\}"',
          desc: `
          Save episode files (video, image, metadata) in a directory named after the season (inside the show's directory), using a filename based the episode's placement in the season.

          e.g. will save videos to:

          | Endurance Run/
          |   Season 01 - Shin Megami Tensei: Persona 4/
          |     S01E01.mp4
          |     S01E02.mp4
          |     S01E03.mp4
          |     ...
          |   Season 02 - The Matrix Online/
          |     S02E01.mp4
          |     ...
          |   ...
          | VinnyVania/
          |   Season 01 - Castlevania/
          |     S01E01.mp4
          |     S01E02.mp4
          |     S01E03.mp4
          |     ...
          |   Season 02 - Castlevania II- Simon's Quest/
          |     S02E01.mp4
          |     ...
          |   ...
          `
        }
      ]
    },
    {
      header: 'File Template Values',
      content: [
        { name: '\\{name\\}', summary: 'The name of the video' },
        { name: '\\{game\\}', summary: 'The first game associated with the video' },
        { name: '\\{time\\}', summary: 'The date and time the video was published' },
        { name: '\\{date\\}', summary: 'The date the video was published' },
        { name: '\\{year\\}', summary: 'The year the video was published' },
        { name: '\\{episode\\}', summary: 'Episode number (1, 2, etc.) of this video within the season' },
        { name: '\\{show_episode\\}', summary: 'Episode number (1, 2, etc.) of this video within the show' },
        { name: '\\{episode_count\\}', summary: 'The total number of episodes in the season' },
        { name: '\\{show_episode_count\\}', summary: 'The total number of episodes in the show' },
        { name: '\\{guid\\}', summary: `The video's GUID` },
        { name: '\\{id\\}', summary: `The video's ID` },
        { name: '\\{show\\}', summary: `The show title` },
        { name: '\\{show_guid\\}', summary: `The show's GUID` },
        { name: '\\{show_id\\}', summary: `The show's ID` },
        { name: '\\{season\\}', summary: `The video's season number (1, 2, etc.)` },
        { name: '\\{season_name\\}', summary: `The name of the video's season (2014, "Castlevania", etc.)` },
        { name: '\\{season_count\\}', summary: `The total number of seasons in the show` },
        { name: '\\{quality\\}', summary: `The downloaded file quality; one of ["hd", "high", "low", "info"]` }
      ]
    },
    {
      header: 'Content Anchors',
      content: `
      Use content anchors to specify batches of videos (or images, etc.) from the specified show. Anchors identify a particular episode (or season) of the show; the batch will begin or end with that episode.

      Content anchors begin with "from", "to", "after" or "through", and should be included as part of the download command as if specifying an episode or season.

      For more information, try "download from help"
      `
    },
    {
      header: 'Content Anchor Types',
      content: [
        { name: 'from {underline options}', summary:`Include episodes after, and including, the video or season specified.` },
        { name: 'after {underline options}', summary:`Include episodes after (but not including) the video or season specified.` },
        { name: 'through {underline options}', summary:`Include episodes up to, and including, the video or season specified.` },
        { name: 'to {underline options}', summary:`Include episodes up to (but not including) the video or season specified.` },
      ]
    },
    {
      header: 'Content Anchor Options',
      content: [
        { name: '-v, --video {underline text}', summary:`Text specifying a video, such as its name` },
        { name: '-e, --episode {underline number}', summary:`The episode number, with 1 being the first` },
        { name: '-s, --season {underline text or number}', summary:`The season number, with 1 being the first (or season name, like "2014")` },
        { name: '{underline text}', summary:`A season / episode identifier, e.g. "S02E17".` },
      ]
    },
    {
      header:  'Content Anchor Examples',
      content: [
        {
          example: 'download "Game of the Year" from --season 2014 through --season 2016',
          desc: `Download all episodes of the "Game of the Year" show in the 2014, 2015, and 2016 seasons.`
        },
        {
          example: 'download "Quick Look" to --video "Balan Wonderworld"',
          desc: `Download all Quick Look episodes up to -- but not including --
          Balan Wonderworld.`
        },
        {
          example: 'download Endurance --season Shenmue from --episode 10 to --episode 20',
          desc: `Download the 10th, 11th, ... 19th episodes of the "Shenmue" season of Endurance Run`
        }
      ]
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

  const { show, video, episode, season, premium, free, out, replace, details, commit } = options;
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

  if (video === void 0 && show === void 0 && !anchorCommands.length) {
    logger.print(parser.help());
    logger.in('red').print(`Must specify a show, video, or content anchor`);
    throw new Error(`download: must specify content to download`);
  }

  if ((video !== void 0) && (episode !== void 0)) {
    throw new Error(`Can't use both --video <identifier> and --episode <number>`);
  }

  if (show_only && ((video != void 0) || (episode !== void 0) || (season !== void 0) || (anchorCommands.length))) {
    throw new Error(`Cannot combine --show-only with video/season/episode selection`);
  }

  if ((video !== void 0) && (season !== void 0)) {
    throw new Error(`Cannot specify both --video <identifier> and --season <season>; omit "--season" or use "--episode <number>" instead`)
  }

  if (premium && free) {
    throw new Error(`Can't combine --premium and --free; nothing will match`);
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

  const filter: ListFieldFilter[] = [];
  if (premium) filter.push({ field:'premium', value:'true' });
  if (free) filter.push({ field:'premium', value:'false' });

  // Note: anchor-free downloads are equivalent to "from X" "through X" for the
  // same single element (episode or season). Full-show downloads are equivalent
  // to "from 1" "through <max>".
  const anchors: AnchorResult[] = [];
  let targetShow: VideoShow|void = null;
  let targetCatalog: Catalog|void = null;
  let targetVideo: Video|void = null;

  // query for the show if possible
  if (show) {
    const match = await shows.find({ query:show, filter }, context);
    if (match) {
      targetShow = match.show;
      targetCatalog = await catalog.create({ show:targetShow, filter }, context);
      logger.info(`Found ${match.show.title} by ${match.matchType}`);
    } else {
      logger.in('red').print(`No shows found for "${show}"`);
      return ERROR.UNKNOWN_SHOW;
    }
  }

  if (video) {
    const match = await videos.find({ query:video, show:targetShow, filter}, context);
    if (match) {
      targetVideo = match.video;
      logger.info(`Found ${match.video.name} by ${match.matchType}`);
      if (!targetShow) {
        const showID = targetVideo.video_show ? targetVideo.video_show.id : null;
        if (showID) {
          const showMatch = await shows.find({ query:showID }, context);
          if (showMatch) {
            targetShow = showMatch.show;
          } else {
            logger.in('red').print(`No shows found for "${showID}"`);
            return ERROR.UNKNOWN_SHOW;
          }
        } else {
          logger.warn(`Video ${match.video.name} has no associated show; show- and season-based features will fail`);
        }
      }

      if (targetShow && !targetCatalog) targetCatalog = await catalog.create({ show:targetShow, filter }, context);
      if (targetShow && targetCatalog) {
        const episodeNumber = targetCatalog.episodes.findIndex(a => a.id === match.video.id) + 1;
        const anchorOpts: AnchorOpts = {
          show: targetShow,
          showCatalog: targetCatalog,
          seasonType: season_type || targetCatalog.preferredSeasons,
          anchorType: 'from',
          episode: episodeNumber
        }
        anchors.push(await anchor.find(anchorOpts, context));
        anchors.push(await anchor.find({ ...anchorOpts, anchorType: 'through' }, context));
      }
    } else {
      logger.in('red').print(`No videos found for "${video}"`);
      return ERROR.UNKNOWN_VIDEO;
    }
  }

  if (season && episode === void 0) {
    if (!targetShow) throw new Error(`Must specify valid --show to identify a video by --season`);
    if (!targetCatalog) targetCatalog = await catalog.create({ show:targetShow, filter }, context);

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
    if (!targetCatalog) targetCatalog = await catalog.create({ show:targetShow, filter }, context);

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

  if (!targetShow && !targetVideo) {
    throw new Error(`Something went wrong: can't identify show or video`);
  } else if (targetShow && !targetCatalog) {
    throw new Error(`Something went wrong: couldn't create catalog`);
  } else if ((!targetShow || !targetCatalog) && anchorCommands.length) {
    throw new Error(`Can only process anchor commands (from, to, after, through) for shows (not videos that have no show)`);
  }

  if (show_only) {
    if (targetShow && targetCatalog) {
      const anchorOpts: AnchorOpts = {
        show: targetShow,
        showCatalog: targetCatalog,
        seasonType: season_type || targetCatalog.preferredSeasons,
        anchorType: 'to',
        episode: 1
      }
      anchors.push(await anchor.find(anchorOpts, context));
    } else {
      throw new Error(`Couldn't identify show or create catalog (can't use "--show-only" when there's no show for the video!)`);
    }
  }

  for (const anchorCommand of anchorCommands) {
    if (!targetShow || !targetCatalog) {
      throw new Error(`Something went wrong; no catalog to process anchor commands`);
    }
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
  if (targetCatalog) {
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
  } else if (targetVideo) {
    // no catalog (meaning, no show) but there is a video specified.
    includedIDs.add(targetVideo.id);
  }

  // print the videos to be downloaded
  logger.print();
  let firstIncluded: CatalogEpisodeReference|void = null;
  if (targetShow && targetCatalog) {
    const seasons = targetCatalog.seasons[season_type || targetCatalog.preferredSeasons];

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
  } else if (targetVideo) {
    logger.in('blue').print(`${targetVideo.name}`);
    logger.print(`  No show information available`);
  }
  logger.print();

  // print example filenames
  const exampleQuality = quality === 'highest' ? 'hd' : quality;
  const exTemplateOpts: TemplateOpts = { show:targetShow, video:targetVideo, episode:firstIncluded };
  const baseFilenameExample = toFilename(out, null, exTemplateOpts);
  const videoFilenameExample = toFilename(video_out, baseFilenameExample, { ...exTemplateOpts, quality:exampleQuality, finalize:true });
  const imageFilenameExample = toFilename(image_out, baseFilenameExample, { ...exTemplateOpts, quality:exampleQuality, finalize:true });
  const dataFilenameExample = toFilename(data_out, baseFilenameExample, { ...exTemplateOpts, quality:'info', finalize:true });
  const baseShowFilenameExample = toFilename(show_out, null, { show:targetShow });
  const showImageFilenameExample = toFilename(show_image_out, baseShowFilenameExample, { show:targetShow, quality:exampleQuality, finalize:true });
  const showDataFilenameExample = toFilename(show_metadata_out, baseShowFilenameExample, { show:targetShow, quality:'info', finalize:true });

  const savingVideo = targetVideo && !targetCatalog && (dataFilenameExample || imageFilenameExample || videoFilenameExample);
  const savingEpisodes = targetCatalog && includedIDs.size && (dataFilenameExample || imageFilenameExample || videoFilenameExample);
  const savingShow = showImageFilenameExample || showDataFilenameExample;

  if (!savingVideo && !savingEpisodes && !savingShow) {
    if (!firstIncluded && !show_only && targetCatalog) {
      logger.print(`No episodes flagged for download (try relaxing your from/after/to/through requirements).`);
    } else if (show_only) {
      logger.print(`To save, specify --show-out, --show-image-out, etc. as a templated filename`);
    } else {
      logger.print(`To save, specify --out, --video-out, etc. as a templated filename`);
    }
    return ERROR.NONE;
  }

  if (!commit) {
    const action = replace ? `download (and replace)` : `download (if missing)`;
    if (savingShow && targetShow) {
      logger.print(`Will ${action} data for show "${targetShow.title}" to template-based files, saving`);
      if (showImageFilenameExample) logger.print(`  ${quality} quality image to "${showImageFilenameExample}.png"`);
      if (showDataFilenameExample) logger.print(`  show metadata to "${showDataFilenameExample}.json"`);
    }
    if (savingVideo || savingEpisodes) {
      const target = targetVideo || (firstIncluded && firstIncluded.video);
      const targetStr = includedIDs.size > 1 ? `${includedIDs.size} videos` : `video "${target ? target.name : 'Unknown'}"`;
      logger.print(`Will ${action} data for ${targetStr} to template-based files, saving (e.g.)`);
      if (videoFilenameExample) logger.print(`  ${quality} quality video to "${videoFilenameExample}.mp4"`);
      if (imageFilenameExample) logger.print(`  ${quality} quality image to "${imageFilenameExample}.png"`);
      if (dataFilenameExample) logger.print(`  video metadata to "${dataFilenameExample}.json"`);
    } else if (!show_only) {
      if (!firstIncluded && targetCatalog) {
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

  if (savingShow && targetShow) {
    logger.print(`Saving ${targetShow.title}...`);
    const results = await saveShow(targetShow, options, context);
    const size = results.reduce((acc, r) => acc + (r.updated ? r.size : 0), 0);

    bytesSaved += size;
    if (megabyte_limit && megabyte_limit <= bytesSaved / (1024 * 1024)) {
      logger.print(`Saved ${(bytesSaved / (1024 * 1024)).toFixed(2)} megabytes; size limit reached`);
      limitReached = true;
    }
  }

  if (savingVideo && targetVideo) {
    logger.print(`Saving ${targetVideo.name}...`);
    const results = await saveVideo(targetShow, targetVideo, null, options, context);
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
    logger.trace(`Downloaded ${bytesSaved} so far`);
    if (megabyte_limit && megabyte_limit <= bytesSaved / (1024 * 1024)) {
      logger.print(`Saved ${(bytesSaved / (1024 * 1024)).toFixed(2)} megabytes; size limit reached`);
      limitReached = true;
    }
  }

  if (savingEpisodes && targetShow && targetCatalog) {
    const seasons = targetCatalog.seasons[season_type || targetCatalog.preferredSeasons];
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

        const eNumStr = `${e + 1}`.padStart(2, '0');
        logger.print(`Saving S${sNumStr}E${eNumStr} - ${targetEpisode.video.name}...`);

        const results = await saveVideo(targetShow, null, targetEpisode, options, context);
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
        logger.trace(`Downloaded ${bytesSaved} so far`);
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

const no_out = ['no', 'null', 'none'];
function toFilename(out: string|void, fallback: string|void, opts:TemplateOpts): string|void {
  if (out && no_out.includes(out.toLowerCase())) {
    return null;
  }
  const t = out ? out : fallback;
  return t ? template.map(t, opts) : null;
}

async function saveShow(show: VideoShow, options: any, context: Context): Promise<SaveResult[]> {
  const { logger } = context;
  const { replace } = options;
  const quality = options['quality'] || 'highest';
  const show_out = options['show-out'];
  const show_image_out = options['show-image-out'];
  const show_metadata_out = options['show-metadata-out'];

  const baseFilename = toFilename(show_out, null, { show });
  const imageFilename = toFilename(show_image_out, baseFilename, { show });
  const dataFilename = toFilename(show_metadata_out, baseFilename, { show, quality:'info' });
  const results: SaveResult[] = [];

  if (imageFilename || dataFilename) {
    if (dataFilename) {
      logger.info(`Saving show metadata to ${dataFilename}.json...`);
      const result = await save.showInfo(show, { filename:dataFilename, logger, replace });
      results.push(result);
    }

    if (imageFilename) {
      logger.info(`Saving ${quality} quality image to ${imageFilename}[.ext]...`);
      const result = await save.showImage(show, { filename:imageFilename, logger, replace, quality }, context);
      results.push(result);
    }
  }

  return results;
}

async function saveVideo(show: VideoShow|void, video: Video|void, episode: CatalogEpisodeReference|void, options: any, context: Context): Promise<SaveResult[]> {
  const targetVideo = video || (episode ? episode.video : null);
  if (!targetVideo) {
    throw new Error(`Can't save non-existent video`);
  }

  const { logger } = context;
  const { out, replace } = options;
  const quality = options['quality'] || 'highest';
  const video_out = options['video-out'];
  const data_out = options['metadata-out'];
  const image_out = options['image-out'];

  const templateOpts: TemplateOpts = { show, video, episode }
  const baseFilename = toFilename(out, null, templateOpts);
  const videoFilename = toFilename(video_out, baseFilename, templateOpts);
  const imageFilename = toFilename(image_out, baseFilename, templateOpts);
  const dataFilename = toFilename(data_out, baseFilename, { ...templateOpts, quality:'info' });

  const results: SaveResult[] = [];

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

  return results;
}
