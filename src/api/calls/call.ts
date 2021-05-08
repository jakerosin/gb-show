'use strict';

import { get as httpieGet } from 'httpie';
import { encode } from 'querystring';

import { HttpieResponse } from 'httpie';

import { ApiConfig } from '../base/config';
import { ItemFilter, ListFilter, PageFilter, SearchFilter, toParams } from '../base/filter';
import { ItemResult, ListResult } from '../base/result';
import * as Shared from './shared';

type URL = {
  full: string;
  safe: string;
  base: string;
  tag: string;
}

let last_call = 0;
let calling = false;

function toURL(tag: string, base: string, filter: ItemFilter = {}, config: ApiConfig = {}): URL {
  const api_key =  config.api_key || Shared.config.api_key;
  const filterParams = toParams({ ...Shared.filter, ...filter });
  const safeQuery = encode(filterParams);
  if (api_key && api_key.length) filterParams.api_key = api_key;
  const fullQuery = encode(filterParams);

  return {
    full: base + (fullQuery.length ? `?${fullQuery}` : ''),
    safe: base + (safeQuery.length ? `?${safeQuery}` : ''),
    base,
    tag
  }
}

async function wait(millis: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(function() {
      res(null);
    }, millis);
  })
};

function nextDelay(config: ApiConfig): number {
  let { rate_limit_ms } = config;
  if (rate_limit_ms === void 0) rate_limit_ms = Shared.config.rate_limit_ms;
  return last_call + rate_limit_ms - Date.now();
}

async function rateLimitGet(url: URL, config: ApiConfig): Promise<HttpieResponse> {
  const logger = config.logger || Shared.config.logger;
  try {
    while (calling) {
      if (logger) logger.debug(`${url.tag}: a call is in progress, waiting 500`);
      await wait(500);
    }
    calling = true;

    let delay = 0;
    while ((delay = nextDelay(config)) > 0) {
      if (logger) logger.debug(`${url.tag}: rate-limiting call, waiting ${delay}`);
      await wait(delay)
    }

    if (logger) logger.debug(`${url.tag}: calling GET ${url.safe}`);
    return await httpieGet(url.full);
  } catch (err) {
		if (logger) logger.error(err);
		throw new Error(`${url.tag}: an external API error occurred in GET ${url.safe} ; ${err.message}`);
	} finally {
    last_call = Date.now()
    calling = false;
  }
}

function validateResponseStatus(url: URL, data: any): void {
  if (!data) {
    throw new Error(`${url.tag}: GET ${url.safe} provided empty response`);
  } else if ( data.status_code !== 1) {
    throw new Error(`${url.tag}: GET ${url.safe} provided error ${data.error}`);
  }
}

export async function get<T>(tag: string, path: string, filter: ItemFilter, config: ApiConfig): Promise<ItemResult<T>> {
  const url = toURL(tag, path, filter, config);

  const { data } = await rateLimitGet(url, config);
  validateResponseStatus(url, data);

  if (!data.results) {
    throw new Error(`${tag}:  GET ${url.safe} provided no results ${JSON.stringify(data)}`);
  } else if (Array.isArray(data.results)) {
    throw new Error(`${tag}:  GET ${url.safe} provided array results ${JSON.stringify(data)}`);
  }

  return data as ItemResult<T>;
}

export async function list<T>(tag: string, path: string, filter: ListFilter, config: ApiConfig): Promise<ListResult<T>> {
  const url = toURL(tag, path, filter, config);

  const { data } = await rateLimitGet(url, config);
  validateResponseStatus(url, data);

  return data as ListResult<T>;
}

export async function autopageList<T>(tag: string, path: string, filter: ListFilter, config: ApiConfig, until?: (T) => boolean): Promise<ListResult<T>> {
  let offset = filter.offset || 0;
  let total = Infinity;
  let stop = false;

  let results: T[] = [];
  let output: ListResult<T>|void = null;

  while (!stop && offset < total) {
    const data = await list<T>(tag, path, { ...filter, offset }, config);
    if (!output) {
      output = { ...data, results }
      total = data.number_of_total_results;
    }

    if (data.results && data.results.length) {
      offset += data.results.length;
      stop = data.results.some(item => {
        results.push(item);
        return until && until(item);
      });
    } else {
      stop = true;
    }
  }

  if (!output) {
    throw new Error(`${tag}: no pagination framework`);
  }

  return output;
}

export async function search<T>(tag: string, query: string, resources: string|string[], filter: PageFilter, config: ApiConfig): Promise<ListResult<T>> {
  const path = 'https://www.giantbomb.com/api/search/';
  const url = toURL(tag, path, { ...filter, resources:[].concat(resources), query } as SearchFilter, config);

  const { data } = await rateLimitGet(url, config);
  validateResponseStatus(url, data);

  return data as ListResult<T>;
}

export async function autopageSearch<T>(tag: string, query: string, resources: string|string[], filter: PageFilter, config: ApiConfig, until?: (T) => boolean): Promise<ListResult<T>> {
  let page = filter.page || 0;
  let total = Infinity;
  let stop = false;

  let results: T[] = [];
  let output: ListResult<T>|void = null;

  while (!stop) {
    const data = await search<T>(tag, query, resources, { ...filter, page }, config);
    page += 1;

    if (!output) {
      output = { ...data, results }
    }

    if (data.results && data.results.length) {
      stop = data.results.some(item => {
        results.push(item);
        return until && until(item);
      });
    } else {
      stop = true;
    }
  }

  if (!output) {
    throw new Error(`${tag}: no pagination framework`);
  }

  return output;
}
