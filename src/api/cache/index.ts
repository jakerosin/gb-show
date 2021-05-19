'use strict';

import { wait } from '../../utils';
import Logger from '../../utils/logger';
import io from '../../io';

interface CachedResponse {
  response: any;
  date: Date;
}

interface  CachedResponses {
  [path: string]: CachedResponse;
}

interface CachedCall {
  path: string;
  date: Date;
}

interface CacheData {
  calls: CachedCall[];
  responses: CachedResponses;
}

export interface CacheOpts {
  filename: string;
  cache_duration_ms?: number|void;
  cache_flush_ms?: number|void;
  logger?:  Logger;
}

function evictData(data: CacheData, opts: CacheOpts): number {
  const logger = opts.logger;
  const keepFrom = new Date(Date.now() - (opts.cache_duration_ms || 0));
  const keepFromIndex = data.calls.findIndex(call => call.date >= keepFrom);

  if (keepFromIndex !== 0 && data.calls.length) {
    if (keepFromIndex === -1) {
      const evicted = data.calls.length;
      if (logger) logger.debug(`api.cache.evict: evicting all ${evicted} calls`);
      data.calls = [];
      data.responses = {};
      return evicted;
    } else {
      if (logger) logger.debug(`api.cache.evict: evicting ${keepFromIndex} of ${data.calls.length} calls`);
      for (let i = 0; i < keepFromIndex; i++) {
        const path = data.calls[i].path;
        if (logger) logger.trace(`api.cache.evict: evicting ${data.calls[i].date}: ${path}`);
        delete data.responses[path];
      }
      data.calls = data.calls.slice(keepFromIndex);
      return keepFromIndex;
    }
  }

  if (logger) logger.trace(`api.cache.evict: nothing to evict from ${data.calls.length} calls`);
  return 0;
}

interface FlushOpts {
  data: CacheData;
  counter: number;
  pending: boolean;
}
let flushOpts: { [filename: string]: FlushOpts } = {};
async function flushData(data: CacheData, opts: CacheOpts): Promise<void> {
  const { filename, logger, cache_flush_ms } = opts;
  const counter = flushOpts[filename] ? flushOpts[filename].counter + 1 : 0;
  flushOpts[filename] = {
    data: {
      calls: [ ...data.calls ],
      responses: { ...data.responses }
    },
    counter,
    pending: true
  };

  if (logger) logger.trace(`api.cache.flush: waiting ${cache_flush_ms || 0} ms before write`);
  return wait(cache_flush_ms || 0).then(() => {
    const opts = flushOpts[filename];
    if (counter === opts.counter) {
      opts.pending = false;
      if (logger) logger.debug(`api.cache.flush: writing cache to ${filename}`);
      return io.writeJson(opts.data, { filename, logger }).then(() => {
        if (logger) logger.trace(`api.cache.flush: done`);
      });
    }
  });
}

export default class Cache implements CacheOpts {
  filename: string;
  cache_duration_ms: number;
  cache_flush_ms: number;
  logger?: Logger;
  ready: boolean;
  data: CacheData;

  constructor(opts: CacheOpts) {
    this.filename = opts.filename;
    this.cache_duration_ms = opts.cache_duration_ms || 1000 * 60 * 60 * 4;  // 4 hours
    this.cache_flush_ms = opts.cache_flush_ms || 1000 * 5;
    this.logger = opts.logger;
    this.ready = false;
    this.data = { calls:[], responses:{} };
  }

  static async loaded(opts: CacheOpts): Promise<Cache> {
    const cache = new Cache(opts);
    await cache.load();
    return cache;
  }

  static async initialized(opts: CacheOpts): Promise<Cache> {
    const cache = new Cache(opts);
    await cache.init();
    return cache;
  }

  async load(): Promise<Cache> {
    if (this.ready) {
      throw new Error("api.cache: already loaded or initialized");
    }

    const { logger, filename } = this;
    const opts = this;
    let evicted = 0;
    if (logger) logger.trace(`api.cache loading ${filename}`);
    this.data = await io.read({
      filename,
      logger,
      defaultValue: this.data,
      processor: (text: string) => {
        const json = JSON.parse(text);
        // TODO validate input format
        for (const call of json.calls) {
          call.date = new Date(call.date);
        }
        for (const path in json.responses) {
          json.responses[path].date = new Date(json.responses[path].date);
        }
        // evict
        evicted = evictData(json, opts);
        return json;
      }
    });

    this.ready = true;

    if (evicted) flushData(this.data, this);
    return this;
  }

  async init(): Promise<Cache> {
    if (this.ready) {
      throw new Error("api.cache: already loaded or initialized");
    }
    this.data = { calls:[], responses:{} };
    this.ready = true;

    flushData(this.data, this);
    return this;
  }

  async get(path: string): Promise<any|void> {
    const { logger, data, cache_duration_ms } = this;
    const threshold = new Date(Date.now() - cache_duration_ms);
    const response = data.responses[path];
    if (response && response.date > threshold) {
      if (logger) logger.debug(`api.cache.get: providing cached response for ${path}`);
      return response.response;
    } else if (response) {
      if (logger) logger.trace(`api.cache.get: cached response is stale for ${path}`);
    } else {
      if (logger) logger.trace(`api.cache.get: no cached response for ${path}`);
    }
  }

  async put(path: string, response: any): Promise<void> {
    const { logger } = this;
    if (logger) logger.trace(`api.cache.put: new response for ${path}`);
    evictData(this.data, this);
    if (path in this.data.responses) {
      if (logger) logger.trace(`api.cache.put: manually removing previous response for ${path}`);
      const index = this.data.calls.findIndex(call => call.path === path);
      if (index > -1) {
        this.data.calls = this.data.calls.slice(0, index).concat(this.data.calls.slice(index + 1));
        delete this.data.responses[path];
      }
    }

    if (logger) logger.debug(`api.cache.put: storing response for ${path}`);
    const date = new Date();
    this.data.calls.push({ path, date });
    this.data.responses[path] = { response, date };

    flushData(this.data, this);
  }

  async flush(): Promise<void> {
    const { filename, logger } = this;
    const opts = flushOpts[filename];
    if (opts && opts.pending) {
      await flushData(opts.data, { filename, logger });
    }
  }
}
