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

export type SaveQuality = 'highest'|'hd'|'high'|'low';

export interface SaveOpts extends WriteArgs {
  replace?: boolean|void;
}

export interface DownloadOpts extends SaveOpts {
  quality?: SaveQuality;
}

function filenameWithExtension(filename: string, extension: string): string {
  const full = path.normalize(filename).replace(RegExp("{ext}", "ig"), extension);
  return full.endsWith(`.${extension}`) ? full : `${full}.${extension}`;
}

function imageUrl(quality: SaveQuality, imageResult: ImageResult): string|void {
  let url: string|void = '';
  if (quality === 'highest') {
    return imageUrl('hd', imageResult)
      || imageUrl('high', imageResult)
      || imageUrl('low', imageResult);
  }
  if (quality === 'hd') return imageResult.screen_large_url;
  if (quality === 'high') return imageResult.super_url;
  if (quality === 'low') return imageResult.medium_url;
}

function videoUrl(quality: SaveQuality, video: Video): string|void {
  let url: string|void = '';
  if (quality === 'highest') {
    return videoUrl('hd', video)
      || videoUrl('high', video)
      || videoUrl('low', video);
  }
  if (quality === 'hd') return video.hd_url;
  if (quality === 'high') return video.high_url;
  if (quality === 'low') return video.low_url;
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

async function downloadUrl(tag: string, url: string, opts: DownloadOpts, context: Context): Promise<void> {
  const { filename, replace, backup, direct } = opts;
  const { logger, api_key } = context;

  // replace?
  if (!replace && await io.exists({ filename })) {
    if (logger) logger.debug(`${tag}: file ${filename} already exists; not replacing`);
    return;
  }

  // container directory?
  await createContainerDirectory(tag, opts);

  // download
  const dl = async (destination: string) => {
    if (logger) logger.debug(`${tag}: downloading ${url}`);
    const query = context.api_key ? `?api_key=${context.api_key}`: '';
    const report = logger && logger.would('info');
    const stream = download(url + query);
    stream.pipe(fsSync.createWriteStream(destination));
    if (report) {
      let progressStr = '';
      stream.on('downloadProgress', progress => {
        const { percent, transferred, total } = progress;
        const percentStr = `${Math.floor(percent * 100)}`;
        if (percentStr !== progressStr) {
          progressStr = percentStr;
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(`  Downloading... ${percentStr}%`);
        }
      });
      stream.on('end', () => {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`  Downloading... 100%\n`);
      })
    }

    await stream;
  }

  // handle backup / direct arguments.
  const labelText = io.label(8);

  // back up the original
  const fileExists = await io.exists({ filename, logger });
  const backupFilename = fileExists
    ? `${filename}.backup.${labelText}`
    : null;
  if (backupFilename) {
    if (logger) logger.trace(`${tag}: backing up ${filename} to ${backupFilename}`);
    await fs.rename(filename, backupFilename);
  }

  // write
  if (direct) {
    if (logger) logger.trace(`${tag}: downloading directly to ${filename}`);
    await dl(filename);
  } else {
    const temp = `${filename}.update.${labelText}`;
    if (logger) logger.trace(`${tag}: writing indirectly to ${temp}`);
    await dl(temp);
    if (logger) logger.trace(`${tag}: renaming ${temp} to ${filename}`);
    await fs.rename(temp, filename);
  }

  // clean up backup
  if (!backup && backupFilename) {
    if (logger) logger.trace(`${tag}: removing backup ${backupFilename}`);
    await fs.unlink(backupFilename);
  }
}

async function saveInfo(tag: string, info: any, opts: SaveOpts): Promise<void> {
  const { logger, replace } = opts;
  const filename = filenameWithExtension(opts.filename, 'json');
  if (!replace && await io.exists({ filename })) {
    if (logger) logger.debug(`${tag}: file ${filename} already exists; not replacing`);
    return;
  }

  await createContainerDirectory(tag, { filename, logger });
  await io.writeJson(info, { ...opts, filename });
}

async function saveImage(tag: string, image: ImageResult, opts: DownloadOpts, context: Context): Promise<void> {
  const { logger } = context;
  const quality = opts.quality || 'highest';
  const url = imageUrl(quality, image);
  if (!url) {
    logger.error(`${tag}: Couldn't identify ${quality} image URL`);
    throw new Error(`Couldn't save image: no ${quality} image URL`);
  }
  const extension = path.extname(url).substring(1);
  const filename = filenameWithExtension(opts.filename, extension);

  await downloadUrl(tag, url, { ...opts, filename }, context);
}

export async function videoInfo(video: Video, opts: SaveOpts): Promise<void> {
  const tag = `commands.utils.archive.save.videoInfo`;
  await saveInfo(tag, video, opts);
}

export async function videoImage(video: Video, opts: DownloadOpts, context: Context): Promise<void> {
  const tag = `commands.utils.archive.save.videoImage`;
  const image = video.image;
  if (!image) throw new Error(`Video has no image`);
  await saveImage(tag, image, opts, context);
}

export async function video(video: Video, opts: DownloadOpts, context: Context): Promise<void> {
  const { logger } = context;
  const tag = `commands.utils.archive.save.video`;
  const quality = opts.quality || 'highest';
  const url = videoUrl(quality, video);
  if (!url) {
    logger.error(`${tag}: Couldn't identify ${quality} video URL`);
    throw new Error(`Couldn't save video: no ${quality} video URL`);
  }
  const extension = path.extname(url).substring(1);
  const filename = filenameWithExtension(opts.filename, extension);

  await downloadUrl(tag, url, { ...opts, filename }, context);
}

export async function showInfo(show: VideoShow, opts: SaveOpts): Promise<void> {
  const tag = `commands.utils.archive.save.showInfo`;
  await saveInfo(tag, video, opts);
}

export async function showImage(show: VideoShow, opts: DownloadOpts, context: Context): Promise<void> {
  const tag = `commands.utils.archive.save.showImage`;
  const image = show.image;
  if (!image) throw new Error(`Show has no image`);
  await saveImage(tag, image, opts, context);
}

export const save = {
  videoInfo,
  videoImage,
  video,
  showInfo,
  showImage
};

export default save;