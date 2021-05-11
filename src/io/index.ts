'use strict';

import crypto from 'crypto';
import { promises as fs } from 'fs';

import Logger from '../utils/logger';

interface FileArgs {
  filename: string;
  logger?: Logger;
}

interface ReadArgs<T> extends FileArgs {
  defaultValue?: T;
}

interface ReadObjectArgs<T> extends ReadArgs<T> {
  processor: (text: string) => Promise<T>;
}

interface WriteArgs extends FileArgs {
  backup?: boolean;
  direct?: boolean;
}

interface WriteObjectArgs<T> extends WriteArgs {
  backup?: boolean;
  direct?: boolean;
  processor: (T) => Promise<string>;
}

function label(n: number) {
  return n > 0 ? `${Date.now()}.${generate(n)}` : `${Date.now()}`;
}

function generate(n: number) {
  return crypto.randomBytes(Math.ceil(n / 2)).toString('hex').substr(0, n);
}

export async function exists(args: FileArgs): Promise<boolean> {
  const { filename, logger } = args;
  try {
    if (logger) logger.trace(`io.exists ${filename} ?`);
    await fs.access(filename);
    if (logger) logger.trace(`io.exists ${filename} YES`);
    return true;
  } catch(e) {
    if (logger) logger.trace(`io.exists ${filename} NO`);
    return false;
  }
}

export async function mkdir(args: FileArgs): Promise<void> {
  const { filename, logger } = args;
  if (logger) logger.trace(`io.mkdir ${filename}`);
  await fs.mkdir(args.filename);
}

export async function read<T>(args: ReadObjectArgs<T>): Promise<T> {
  const { filename, processor, logger } = args;

  let text: string = '';
  try  {
    if (logger) logger.trace(`io.read reading ${filename}`);
    text = (await fs.readFile(filename)).toString();
  } catch (err) {
    if (logger) logger.trace(`io.read ${filename} not found or couldn't be read.`);
    if ('defaultValue' in args) {
      if (logger) logger.debug(`io.read resorting to default value`);
      return args.defaultValue;
    }
    if (logger) logger.error(`io.read couldn't read ${filename} and no default value provided. %s`, err.message);
    throw new Error(`io.read couldn't read ${filename} and no default value was provided`);
  }

  try {
    if (logger) logger.trace(`io.read processing content of ${filename}`);
    return await processor(text);
  } catch (err) {
    if (logger) logger.trace(`io.read ${filename} couldn't be processed.`);
    if ('defaultValue' in args) {
      if (logger) logger.debug(`io.read resorting to default value`);
      return args.defaultValue;
    }
    if (logger) logger.error(`io.read couldn't process ${filename} and no default value provided. %s`, err.message);
    throw new Error(`io.read couldn't process ${filename} and no default value was provided`);
  }
}

export async function readText(args: ReadArgs<string>): Promise<string> {
  return read({ ...args, processor:async (a: string) => a });
}

export async function readJson(args: ReadArgs<any>): Promise<any> {
  return read({ ...args, processor:async (a: string) => JSON.parse(a) });
}

export async function write<T>(value: T, args: WriteObjectArgs<T>): Promise<void> {
  // default: remove backup and write indirectly.
  const labelText = label(8);
  const { filename, backup, direct, processor, logger } = args;

  // back up the original
  const fileExists = await exists({ filename, logger });
  const backupFilename = fileExists
    ? `${filename}.backup.${labelText}`
    : null;
  if (backupFilename) {
    if (logger) logger.trace(`io.write: backing up ${filename} to ${backupFilename}`);
    await fs.copyFile(filename, backupFilename);
  }

  // process
  if (logger) logger.trace(`io.write: processing input to serialized text`);
  const text = await processor(value);

  // write
  if (direct) {
    if (logger) logger.trace(`io.write: writing directly to ${filename}`);
    await fs.writeFile(filename, text);
  } else {
    const temp = `${filename}.update.${labelText}`;
    if (logger) logger.trace(`io.write: writing indirectly to ${temp}`);
    await fs.writeFile(temp, text);
    if (fileExists) {
      if (logger) logger.trace(`io.write: unlinking previous ${filename}`);
      await fs.unlink(filename);
    }
    if (logger) logger.trace(`io.write: renaming ${temp} to ${filename}`);
    await fs.rename(temp, filename);
  }

  // clean up backup
  if (!backup && backupFilename) {
    if (logger) logger.trace(`io.write: removing backup ${backupFilename}`);
    await fs.unlink(backupFilename);
  }
}

export async function writeText(text: string, args: WriteArgs): Promise<void> {
  return await write(text, { ...args, processor:async (a: string) => a });
}

export async function writeJson(json: any, args: WriteArgs): Promise<void> {
  return await write(json, { ...args, processor:async (a: string) => JSON.stringify(a) });
}

export default {
  exists,
  mkdir,
  read,
  readText,
  readJson,
  write,
  writeText,
  writeJson
}
