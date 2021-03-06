'use strict';

import crypto from 'crypto';
import download from 'download';
import fsSync from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import readline from 'readline';

import { io, FileArgs, WriteArgs } from '../../io';
import { ImageResult, Video, VideoShow } from '../../api';
import { Context } from './context';
import { template } from './template';

export type SaveQuality = 'highest'|'auto'|'hd'|'high'|'low';
const qualities: SaveQuality[] = ['hd', 'high', 'low'];
const autoQualities: SaveQuality[] = ['high', 'hd', 'low'];

export interface SaveOpts extends WriteArgs {
  replace?: boolean|void;
}

export interface DownloadOpts extends SaveOpts {
  quality?: SaveQuality;
}

export interface SaveResult {
  filename: string;
  size: number;
  updated: boolean;
}

interface URL {
  path: string|void;
  quality: SaveQuality;
}

function filenameWithExtension(filename: string, extension: string): string {
  const full = path.normalize(filename).replace(RegExp("{ext}", "ig"), extension);
  return full.endsWith(`.${extension}`) ? full : `${full}.${extension}`;
}

function imageUrl(quality: SaveQuality, imageResult: ImageResult): URL|void {
  if (quality === 'highest') {
    for (const q of qualities) {
      const url = imageUrl(q, imageResult);
      if (url && url.path) return url;
    }
  }
  if (quality === 'auto') {
    for (const q of autoQualities) {  // use "high" if possible, "hd" if not
      const url = imageUrl(q, imageResult);
      if (url && url.path) return url;
    }
  }
  const paths = [
    imageResult.screen_large_url,
    imageResult.super_url,
    imageResult.medium_url,
    imageResult.small_url
  ];
  if (quality === 'hd') return { path:paths.find(p => !!p), quality };
  if (quality === 'high') return { path:paths.find(p => !!p), quality };
  if (quality === 'low') return { path:paths.slice(1).find(p => !!p), quality };
}

function videoUrl(quality: SaveQuality, video: Video): URL|void {
  if (quality === 'highest') {
    for (const q of qualities) {
      const url = videoUrl(q, video);
      if (url && url.path) return url;
    }
  }
  if (quality === 'auto') {
    for (const q of autoQualities) {  // use "high" if possible, "hd" if not
      const url = videoUrl(q, video);
      if (url && url.path) return url;
    }
  }
  if (quality === 'hd') return { path:video.hd_url, quality };
  if (quality === 'high') return { path:video.high_url, quality };
  if (quality === 'low') return { path:video.low_url, quality };
}

async function createContainerDirectory(tag: string, opts: FileArgs): Promise<void> {
  const { filename, logger } = opts;
  const base = path.basename(filename);
  const dir = path.dirname(filename);
  if (!(await io.exists({ filename:dir }))) {
    if (logger) logger.debug(`${tag}: creating directory ${dir} for ${base}`);
    await io.mkdirs({ filename:dir, logger });
  }
}

async function downloadUrl(tag: string, url: string, opts: DownloadOpts, context: Context): Promise<SaveResult> {
  const { filename, replace, backup, direct } = opts;
  const { logger, api_key } = context;

  // replace?
  if (!replace && await io.exists({ filename })) {
    if (logger) logger.debug(`${tag}: file ${filename} already exists; not replacing`);
    const stat = await fs.stat(filename);
    return { filename, size:stat.size, updated:false };
  }

  // container directory?
  await createContainerDirectory(tag, opts);

  // download
  const dl = async (destination: string): Promise<number> => {
    if (logger) logger.debug(`${tag}: downloading ${url}`);
    const query = context.api_key ? `?api_key=${context.api_key}`: '';
    const report = logger && logger.would('info');
    const stream = download(url + query);
    let progressStr = '';
    let finished = false;
    let expectedTotal = -1;
    stream.pipe(fsSync.createWriteStream(destination));
    stream.on('downloadProgress', progress => {
      const { percent, transferred, total } = progress;
      if (expectedTotal < 0) expectedTotal = total;
      if (report) {
        const percentStr = `${Math.floor(percent * 100)}`;
        if (percentStr !== progressStr) {
          progressStr = percentStr;
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(`  Downloading... ${percentStr}%`);
        }
      }
    });
    stream.on('end', () => {
      finished = true;
      if (report) {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`  Downloading... 100%\n`);
      }
    });

    try {
      await stream;
    } catch (err) {
      // TODO more sensible handling of this. very likely
      // originates in "download" mishandling the "length"
      // property, which (for very large files like HD videos)
      // might exceed the maximum number size. This doesn't
      // mean the download failed!
      if (logger) logger.debug(`Exception thrown from stream; may be a RangeError for "length" format`);
      if (!(err instanceof RangeError) || !finished) {
        throw err;
      }
    }

    return expectedTotal;
  }

  // handle backup / direct arguments.
  const labelText = io.label(8);

  // back up the original
  const fileExists = await io.exists({ filename, logger });
  const backupFilename = fileExists
    ? `${filename}.backup.${labelText}`
    : null;
  if (backupFilename) {
    try {
      if (logger) logger.trace(`${tag}: backing up ${filename} to ${backupFilename}`);
      await fs.rename(filename, backupFilename);
    } catch (err) {
      if (logger) logger.error(`${tag}: couldn't back up ${filename} before replacement: ${err.message}`);
    }
  }

  // write
  let expectedTotal = -1;
  if (direct) {
    if (logger) logger.trace(`${tag}: downloading directly to ${filename}`);
    expectedTotal = await dl(filename);
  } else {
    const temp = `${filename}.update.${labelText}`;
    if (logger) logger.trace(`${tag}: writing indirectly to ${temp}`);
    expectedTotal = await dl(temp);
    if (logger) logger.trace(`${tag}: renaming ${temp} to ${filename}`);
    await fs.rename(temp, filename);
  }

  // clean up backup
  if (!backup && backupFilename) {
    try {
      if (logger) logger.trace(`${tag}: removing backup ${backupFilename}`);
      await fs.unlink(backupFilename);
    } catch (err) {
      if (logger) logger.error(`${tag}: couldn't remove back up ${backupFilename} after replacement: ${err.message}`);
    }
  }

  const stat = await fs.stat(filename);
  if (logger) logger.trace(`${tag}: downloaded ${stat.size} bytes`);
  if (`${expectedTotal}` !== '-1' && `${stat.size}` !== `${expectedTotal}`) {
    if (logger) logger.warn(`${tag}: Downloaded file size does not match expectations. Verify that ${filename} works as expected.`);
  }
  return { filename, size:stat.size, updated:true };
}

async function saveInfo(tag: string, info: any, opts: SaveOpts): Promise<SaveResult> {
  const { logger, replace } = opts;
  const noExtFilename = template.map(opts.filename, { quality:'info', finalize:true });
  const filename = filenameWithExtension(noExtFilename, 'json');
  if (!replace && await io.exists({ filename })) {
    if (logger) logger.debug(`${tag}: file ${filename} already exists; not replacing`);
    const stat = await fs.stat(filename);
    return { filename, size:stat.size, updated:false };
  }

  await createContainerDirectory(tag, { filename, logger });
  await io.writeJson(info, { ...opts, filename });

  const stat = await fs.stat(filename);
  return { filename, size:stat.size, updated:true };
}

async function saveImage(tag: string, image: ImageResult, opts: DownloadOpts, context: Context): Promise<SaveResult> {
  const { logger } = context;
  const quality = opts.quality || 'highest';
  const url = imageUrl(quality, image);
  if (!url || !url.path) {
    logger.error(`${tag}: Couldn't identify ${quality} image URL`);
    throw new Error(`Couldn't save image: no ${quality} image URL`);
  }
  const extension = path.extname(url.path).substring(1);
  const noExtFilename = template.map(opts.filename, { quality:url.quality, finalize:true });
  const filename = filenameWithExtension(noExtFilename, extension);

  return await downloadUrl(tag, url.path, { ...opts, filename }, context);
}

export async function videoInfo(video: Video, opts: SaveOpts): Promise<SaveResult> {
  const tag = `commands.utils.archive.save.videoInfo`;
  return await saveInfo(tag, video, opts);
}

export async function videoImage(video: Video, opts: DownloadOpts, context: Context): Promise<SaveResult> {
  const tag = `commands.utils.archive.save.videoImage`;
  const image = video.image;
  if (!image) throw new Error(`Video has no image`);
  return await saveImage(tag, image, opts, context);
}

export async function video(video: Video, opts: DownloadOpts, context: Context): Promise<SaveResult> {
  const { logger } = context;
  const tag = `commands.utils.archive.save.video`;
  const quality = opts.quality || 'highest';
  const url = videoUrl(quality, video);
  if (!url || !url.path) {
    logger.error(`${tag}: Couldn't identify ${quality} video URL`);
    throw new Error(`Couldn't save video: no ${quality} video URL`);
  }
  const extension = path.extname(url.path).substring(1);
  const noExtFilename = template.map(opts.filename, { quality:url.quality, finalize:true });
  const filename = filenameWithExtension(noExtFilename, extension);

  return await downloadUrl(tag, url.path, { ...opts, filename }, context);
}

export async function showInfo(show: VideoShow, opts: SaveOpts): Promise<SaveResult> {
  const tag = `commands.utils.archive.save.showInfo`;
  return await saveInfo(tag, show, opts);
}

export async function showImage(show: VideoShow, opts: DownloadOpts, context: Context): Promise<SaveResult> {
  const tag = `commands.utils.archive.save.showImage`;
  const image = show.image;
  if (!image) throw new Error(`Show has no image`);
  return await saveImage(tag, image, opts, context);
}

export const save = {
  videoInfo,
  videoImage,
  video,
  showInfo,
  showImage
};

export default save;
